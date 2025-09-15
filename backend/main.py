from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import os
from dotenv import load_dotenv
import httpx
from httpx import RequestError, HTTPStatusError, TimeoutException
from datetime import datetime
import traceback

from database import get_db, create_tables
from models import AgentConfiguration, Call, AgentConfigurationPydantic, CallTrigger
from retell_handler import RetellHandler
from pydantic import BaseModel
from typing import Dict, Any

# Load environment variables
load_dotenv()

# Create tables on startup (no-op if already created)
create_tables()

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

retell_api_key = os.getenv("RETELL_API_KEY")
base_url = os.getenv("BACKEND_URL", "http://localhost:8000")

if not retell_api_key:
    raise RuntimeError("RETELL_API_KEY is not set in environment")

DEFAULT_HTTPX_TIMEOUT = 10.0

class WebhookPayload(BaseModel):
    event: str
    call: Dict[str, Any]

# Agent Configuration Endpoints
@app.get("/api/configurations")
async def get_configurations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentConfiguration))
    return result.scalars().all()

@app.post("/api/configurations")
async def create_configuration(config: AgentConfigurationPydantic, db: AsyncSession = Depends(get_db)):
    db_config = AgentConfiguration(**config.dict())
    db.add(db_config)
    await db.commit()
    await db.refresh(db_config)
    return db_config

@app.put("/api/configurations/{config_id}")
async def update_configuration(config_id: str, config: AgentConfigurationPydantic, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AgentConfiguration).where(AgentConfiguration.id == config_id))
    db_config = result.scalar_one_or_none()
    if not db_config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    for key, value in config.dict().items():
        setattr(db_config, key, value)
    db_config.updated_at = datetime.now()
    await db.commit()
    await db.refresh(db_config)
    return db_config

# Call Management Endpoints
@app.post("/api/calls/trigger")
async def trigger_call(call_data: CallTrigger, db: AsyncSession = Depends(get_db)):
    # Create call record early so we always have an id to reference
    result = await db.execute(select(AgentConfiguration).where(AgentConfiguration.id == call_data.agent_config_id))
    agent_config = result.scalar_one_or_none()
    if not agent_config:
        raise HTTPException(status_code=404, detail="Agent configuration not found")

    db_call = Call(
        agent_config_id=call_data.agent_config_id,
        driver_name=call_data.driver_name,
        load_number=call_data.load_number,
        status="pending"
    )
    db.add(db_call)
    await db.commit()
    await db.refresh(db_call)
    our_call_id = str(db_call.id)

    headers = {"Authorization": f"Bearer {retell_api_key}", "Content-Type": "application/json"}

    # Defensive access to voice settings
    voice_settings = agent_config.voice_settings or {}
    voice_id = voice_settings.get("voice_id")
    if not voice_id:
        db_call.status = "failed"
        db_call.transcript = "Missing voice_settings.voice_id in agent configuration"
        db_call.updated_at = datetime.now()
        await db.commit()
        await db.refresh(db_call)
        raise HTTPException(status_code=500, detail="Agent configuration missing voice_id")

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_HTTPX_TIMEOUT) as client:
            # 1) Create Retell LLM
            llm_data = {
                "version": 0,
                "model": "gpt-4o",
                "model_temperature": 0.0,
                "model_high_priority": False,
                "tool_call_strict_mode": False,
                "general_prompt": agent_config.system_prompt,
                "general_tools": [
                    {
                        "type": "end_call",
                        "name": "end_call",
                        "description": "End the call with user."
                    }
                ],
                "states": [],
                "starting_state": None,
                "begin_message": (agent_config.initial_message or "").format(
                    driver_name=call_data.driver_name,
                    load_number=call_data.load_number
                ),
                "default_dynamic_variables": {
                    "driver_name": call_data.driver_name,
                    "load_number": call_data.load_number
                },
                "knowledge_base_ids": [],
                "kb_config": {
                    "top_k": 3,
                    "filter_score": 0.6
                }
            }
            llm_res = await client.post(
                "https://api.retellai.com/create-retell-llm",
                headers=headers,
                json=llm_data
            )
            if llm_res.status_code != 201:
                raise HTTPException(status_code=500, detail=f"Failed to create LLM: {llm_res.status_code} - {llm_res.text}")
            llm_id = llm_res.json().get("llm_id")
            if not llm_id:
                raise HTTPException(status_code=500, detail="Retell LLM response missing llm_id")

            # 2) Create Agent
            agent_data = {
                "response_engine": {
                    "llm_id": llm_id,
                    "type": "retell-llm"
                },
                "voice_id": voice_id,
                "agent_name": agent_config.name,
                "language": "en-US",
                "responsiveness": voice_settings.get("responsiveness"),
                "interruption_sensitivity": voice_settings.get("interruption_sensitivity"),
                "enable_backchannel": voice_settings.get("enable_backchannel", False),
                "backchannel_frequency": voice_settings.get("backchannel_frequency", 0),
                "backchannel_words": ["yeah", "uh-huh", "okay", "got it", "I see"],
                "reminder_trigger_ms": 10000,
                "reminder_max_count": 2,
                "normalize_for_speech": True,
                "end_call_after_silence_ms": 10000,
                "max_call_duration_ms": 600000,
                "webhook_url": f"{base_url}/retell-webhook"
            }
            agent_res = await client.post(
                "https://api.retellai.com/create-agent",
                headers=headers,
                json=agent_data
            )
            if agent_res.status_code != 201:
                raise HTTPException(status_code=500, detail=f"Failed to create agent: {agent_res.status_code} - {agent_res.text}")
            agent_id = agent_res.json().get("agent_id")
            if not agent_id:
                raise HTTPException(status_code=500, detail="Retell agent response missing agent_id")

            # 3) Create web call
            web_call_data = {
                "agent_id": agent_id,
                "metadata": {
                    "our_call_id": our_call_id,
                    "driver_name": call_data.driver_name,
                    "load_number": call_data.load_number
                }
            }
            web_call_res = await client.post(
                "https://api.retellai.com/v2/create-web-call",
                headers=headers,
                json=web_call_data
            )
            if web_call_res.status_code != 201:
                raise HTTPException(status_code=500, detail=f"Failed to create web call: {web_call_res.status_code} - {web_call_res.text}")
            web_call_info = web_call_res.json()
            retell_call_id = web_call_info.get("call_id")
            access_token = web_call_info.get("access_token")
            if not retell_call_id or not access_token:
                raise HTTPException(status_code=500, detail="Retell web call response missing call_id or access_token")

            # Update call to in_progress
            db_call.retell_call_id = retell_call_id
            db_call.status = "in_progress"
            db_call.updated_at = datetime.now()
            await db.commit()
            await db.refresh(db_call)

            return {
                "call_id": our_call_id,
                "access_token": access_token,
                "status": "initiated"
            }

    except (RequestError, TimeoutException) as e:
        err_text = f"HTTP request to Retell failed: {str(e)}"
        db_call.status = "failed"
        db_call.transcript = err_text
        db_call.updated_at = datetime.now()
        await db.commit()
        await db.refresh(db_call)
        raise HTTPException(status_code=502, detail=err_text)
    except HTTPException:
        raise
    except Exception as e:
        err_text = f"Unexpected error: {str(e)}"
        db_call.status = "failed"
        db_call.transcript = err_text
        db_call.updated_at = datetime.now()
        await db.commit()
        await db.refresh(db_call)
        raise HTTPException(status_code=500, detail=err_text)

@app.get("/api/calls/{call_id}")
async def get_call_details(call_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Call)
        .where(Call.id == call_id)
        .options(selectinload(Call.agent_config))
    )
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    
    # Return call details without scenario_type
    return {
        "id": call.id,
        "retell_call_id": call.retell_call_id,
        "status": call.status,
        "transcript": call.transcript,
        "structured_data": call.structured_data,
        "driver_name": call.driver_name,
        "load_number": call.load_number,
        "created_at": call.created_at,
        "updated_at": call.updated_at,
        "duration_ms": call.duration_ms,
        "agent_config": {
            "id": call.agent_config.id if call.agent_config else None,
            "name": call.agent_config.name if call.agent_config else "Unknown",
            "system_prompt": call.agent_config.system_prompt if call.agent_config else "Not Available",
            "initial_message": call.agent_config.initial_message if call.agent_config else "Not Available"
        },
        "voice_settings": call.agent_config.voice_settings if call.agent_config else None
    }

@app.get("/api/calls")
async def get_all_calls(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Call)
        .options(selectinload(Call.agent_config))
        .order_by(Call.created_at.desc())
    )
    calls = result.scalars().all()
    return [
        {
            "id": call.id,
            "retell_call_id": call.retell_call_id,
            "status": call.status,
            "transcript": call.transcript,
            "structured_data": call.structured_data,
            "driver_name": call.driver_name,
            "load_number": call.load_number,
            "created_at": call.created_at,
            "updated_at": call.updated_at,
            "duration_ms": call.duration_ms,
            "agent_config": {
                "id": call.agent_config.id if call.agent_config else None,
                "name": call.agent_config.name if call.agent_config else "Unknown"
            }
        }
        for call in calls
    ]

@app.post("/retell-webhook")
async def retell_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        body = await request.json()
        print(f"Webhook received: {body}")
        event = body.get("event")
        call_data = body.get("call", {})
        retell_call_id = call_data.get("call_id")

        if not retell_call_id:
            print("Webhook missing call.call_id")
            raise HTTPException(status_code=400, detail="Missing call_id")

        # Get call record with agent_config preloaded
        result = await db.execute(
            select(Call)
            .options(selectinload(Call.agent_config))  # Preload relationship
            .where(Call.retell_call_id == retell_call_id)
        )
        db_call = result.scalar_one_or_none()
        if not db_call:
            # Fallback: Try our_call_id from metadata
            our_call_id = call_data.get("metadata", {}).get("our_call_id")
            if our_call_id:
                result = await db.execute(
                    select(Call)
                    .options(selectinload(Call.agent_config))
                    .where(Call.id == our_call_id)
                )
                db_call = result.scalar_one_or_none()
            if not db_call:
                print(f"Call not found for retell_call_id: {retell_call_id}, our_call_id: {our_call_id}")
                raise HTTPException(status_code=404, detail=f"Call not found for retell_call_id: {retell_call_id}")

        # Initialize RetellHandler
        retell_handler = RetellHandler()

        # Process call_ended or call_analyzed
        if event in ["call_ended", "call_analyzed"]:
            print(f"Processing {event} for retell_call_id: {retell_call_id}, our_call_id: {db_call.id}")
            
            # Unified handling: Prefer webhook data
            transcript = call_data.get("transcript", None)
            duration_ms = call_data.get("duration_ms", 0)
            call_status = call_data.get("call_status", "ended")
            
            if not transcript and event == "call_ended":
                headers = {"Authorization": f"Bearer {retell_api_key}"}
                async with httpx.AsyncClient(timeout=DEFAULT_HTTPX_TIMEOUT) as client:
                    res = await client.get(f"https://api.retellai.com/v2/get-call/{retell_call_id}", headers=headers)
                    if res.status_code != 200:
                        print(f"Failed to get call details: {res.status_code} - {res.text}")
                        db_call.status = "failed"
                        db_call.transcript = f"Failed to fetch call details: {res.status_code} - {res.text[:200]}..."
                        db_call.updated_at = datetime.now()
                        await db.commit()
                        await db.refresh(db_call)
                        raise HTTPException(status_code=502, detail=f"Failed to get call: {res.status_code}")
                    
                    call_info = res.json()
                    transcript_obj = call_info.get("transcript_object", [])
                    transcript = "\n".join([f"{ut.get('role','Agent').capitalize()}: {ut.get('content','')}" for ut in transcript_obj]) or "No transcript available"
                    duration_ms = call_info.get("duration_ms", 0)
            
            # Extract structured data
            state = getattr(db_call, "state", {}) or {}
            structured_data = retell_handler.extract_structured_data(transcript, state)
            
            # Update database
            db_call.status = "completed" if call_status == "ended" else call_status
            db_call.transcript = transcript
            db_call.structured_data = structured_data
            db_call.state = state  # Persist state
            db_call.duration_ms = duration_ms
            db_call.updated_at = datetime.now()
            
            await db.commit()
            await db.refresh(db_call)
            print(f"Updated call {db_call.id}: status={db_call.status}, transcript_length={len(transcript)}, structured_data={structured_data}")
        
        else:
            print(f"Ignored unknown event: {event}")
            return {"status": "ignored_unknown_event"}

        return {"status": "ok"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Webhook error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)