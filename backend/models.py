from sqlalchemy import Column, String, Text, JSON, DateTime, ForeignKey, func, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
from typing import Dict, Any
from pydantic import BaseModel as PydanticBaseModel

Base = declarative_base()

class AgentConfiguration(Base):
    __tablename__ = "agent_configurations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=False)
    initial_message = Column(Text, nullable=False)
    voice_settings = Column(JSON, nullable=False, default={
        "voice_id": "11labs-Adrian",
        "responsiveness": 1,
        "interruption_sensitivity": 1,
        "enable_backchannel": True,
        "backchannel_frequency": 0.8,
        "ambient_sound": None,
        "ambient_sound_volume": 0.5
    })
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    calls = relationship("Call", back_populates="agent_config")

class Call(Base):
    __tablename__ = "calls"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    agent_config_id = Column(UUID(as_uuid=True), ForeignKey("agent_configurations.id"), nullable=False)
    driver_name = Column(String, nullable=False)
    load_number = Column(String, nullable=False)
    retell_call_id = Column(String, nullable=True)
    status = Column(String, default="pending", nullable=False)
    transcript = Column(Text, nullable=True)
    structured_data = Column(JSON, nullable=True)
    state = Column(JSON, nullable=False, default={})  # Added to persist conversation state
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    duration_ms = Column(Integer, nullable=True)

    # Relationship
    agent_config = relationship("AgentConfiguration", back_populates="calls")

# Pydantic Models for API
class AgentConfigurationPydantic(PydanticBaseModel):
    name: str
    system_prompt: str
    initial_message: str
    voice_settings: Dict[str, Any] = {
        "voice_id": "11labs-Adrian",
        "responsiveness": 1,
        "interruption_sensitivity": 1,
        "enable_backchannel": True,
        "backchannel_frequency": 0.8,
        "ambient_sound": None,
        "ambient_sound_volume": 0.5
    }

class CallTrigger(PydanticBaseModel):
    agent_config_id: str
    driver_name: str
    load_number: str