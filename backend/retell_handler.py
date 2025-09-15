import re
import os
from typing import Dict, Any
import openai
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class RetellHandler:
    def __init__(self):
        self.emergency_keywords = [
            "accident", "crash", "blowout", "emergency", "hurt", "injured",
            "breakdown", "broke down", "fire", "medical", "help", "911", "issue"
        ]
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        if not os.getenv("OPENAI_API_KEY"):
            raise ValueError("OPENAI_API_KEY environment variable not set")

    def detect_emergency(self, message: str) -> bool:
        message_lower = message.lower()
        return any(keyword in message_lower for keyword in self.emergency_keywords)

    def handle_emergency(self, message: str, state: Dict) -> Dict:
        if state.get("emergency_step") == "ask_location":
            location = self.extract_location(message)
            state["emergency_location"] = location
            state["emergency_detected"] = True
            return {
                "response": f"I've logged your emergency at {state['emergency_location']}. A human dispatcher will call you back immediately. Stay safe.",
                "end_conversation": True
            }
        else:
            state["emergency_step"] = "ask_location"
            state["emergency_type"] = self.determine_emergency_type(message)
            state["emergency_detected"] = True
            return {
                "response": "I understand this is an emergency. Please stay safe. Can you tell me your exact location? What mile marker or exit are you near?",
                "end_conversation": False
            }

    def determine_emergency_type(self, message: str) -> str:
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an assistant that determines the type of emergency from a driver's message. "
                            "Classify the emergency as one of: 'Accident', 'Breakdown', 'Medical', or 'Other'. "
                            "Return only the emergency type as a string."
                        )
                    },
                    {"role": "user", "content": message}
                ],
                temperature=0.2
            )
            emergency_type = response.choices[0].message.content.strip()
            return emergency_type if emergency_type in ["Accident", "Breakdown", "Medical", "Other"] else "Other"
        except Exception as e:
            print(f"OpenAI error in determine_emergency_type: {e}")
            return "Other"

    def extract_location(self, message: str) -> str:
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Extract the location mentioned in the driver's message. "
                            "The location should include details like highway, mile marker, exit, city, or other identifiable landmarks. "
                            "Return the location as a string. If no clear location is provided, return 'Not specified'."
                        )
                    },
                    {"role": "user", "content": message}
                ],
                temperature=0.2
            )
            location = response.choices[0].message.content.strip()
            return location if location and location != "" else "Not specified"
        except Exception as e:
            print(f"OpenAI error in extract_location: {e}")
            return "Not specified"

    def process_check_in(self, message: str, history: list, state: Dict) -> str:
        lower = message.lower()
        # Prioritize emergency detection
        if self.detect_emergency(message):
            return self.handle_emergency(message, state)["response"]

        if len(message.split()) <= 2:
            state["short_responses"] = state.get("short_responses", 0) + 1
            if state["short_responses"] > 2:
                return "I'm having trouble getting the information I need. I'll have a human dispatcher follow up. Goodbye."
            return "I need more details. Are you driving, delayed, or arrived?"
        state["short_responses"] = 0

        if "repeat" in lower:
            return "Can you repeat your status? Are you in transit, delayed, or arrived?"

        if any(w in lower for w in ["driving", "transit"]):
            return "Got it, you're in transit. What's your current location and ETA?"

        if any(w in lower for w in ["arrived", "destination"]):
            return "Great, you've arrived. Is the delivery complete?"

        if any(w in lower for w in ["delayed", "late"]):
            return "Understood, delayed. Current location and new ETA?"

        return "Can you clarify your status?"

    def process_conversation(self, last_message: str, history: list, state: Dict) -> Dict:
        if self.detect_emergency(last_message):
            state["emergency_detected"] = True
            return self.handle_emergency(last_message, state)

        response = self.process_check_in(last_message, history, state)
        return {"response": response, "end_conversation": "Goodbye" in response}

    def extract_structured_data(self, transcript: str, state: Dict = None) -> Dict[str, Any]:
        try:
            if not state:
                state = {}
            # Check for emergency in transcript or state
            if state.get("emergency_detected") or self.detect_emergency(transcript):
                state["emergency_detected"] = True
                return self.extract_emergency_data(transcript, state)
            return self.extract_check_in_data(transcript, state)
        except Exception as e:
            print(f"Error in extract_structured_data: {e}")
            return {
                "call_outcome": "Status Unknown",
                "error": str(e)
            }

    def extract_emergency_data(self, transcript: str, state: Dict) -> Dict[str, Any]:
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an assistant that extracts structured data from a call transcript in an emergency scenario. "
                            "Return a JSON object with the following fields:\n"
                            "- call_outcome: Always 'Emergency Detected'\n"
                            "- emergency_type: One of 'Accident', 'Breakdown', 'Medical', or 'Other'\n"
                            "- emergency_location: The specific location mentioned (e.g., 'M2 Road, Lahore') or 'Not specified'\n"
                            "- escalation_status: Always 'Escalation Flagged'\n"
                            "Analyze the transcript and extract the most relevant information. If no clear information is available, use 'Not specified' for location and 'Other' for emergency_type."
                        )
                    },
                    {"role": "user", "content": transcript}
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            )
            data = response.choices[0].message.content
            import json
            structured_data = json.loads(data)
            structured_data["state"] = state
            return structured_data
        except Exception as e:
            print(f"OpenAI error in extract_emergency_data: {e}")
            return {
                "call_outcome": "Emergency Detected",
                "emergency_type": "Other",
                "emergency_location": state.get("emergency_location", "Not specified"),
                "escalation_status": "Escalation Flagged",
                "state": state
            }

    def extract_check_in_data(self, transcript: str, state: Dict) -> Dict[str, Any]:
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are an assistant that extracts structured data from a call transcript in a driver check-in scenario. "
                            "Return a JSON object with the following fields:\n"
                            "- call_outcome: One of 'In-Transit Update', 'Arrival Confirmation', or 'Status Unknown'\n"
                            "- driver_status: One of 'Driving', 'Delayed', 'Arrived', or 'Unknown'\n"
                            "- current_location: The specific location mentioned (e.g., 'M2 Road, Lahore') or 'Not specified'\n"
                            "- eta: The estimated time of arrival (e.g., 'Tomorrow, 8:00 AM') or 'Not specified'\n"
                            "Analyze the transcript and extract the most relevant information. If no clear information is available, use 'Status Unknown' for call_outcome, 'Unknown' for driver_status, and 'Not specified' for other fields."
                        )
                    },
                    {"role": "user", "content": transcript}
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            )
            data = response.choices[0].message.content
            import json
            structured_data = json.loads(data)
            structured_data["state"] = state
            return structured_data
        except Exception as e:
            print(f"OpenAI error in extract_check_in_data: {e}")
            return {
                "call_outcome": "Status Unknown",
                "driver_status": "Unknown",
                "current_location": "Not specified",
                "eta": "Not specified",
                "state": state
            }