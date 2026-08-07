import os, json, functools
from dotenv import load_dotenv
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition
from azure.core.exceptions import ResourceNotFoundError

load_dotenv()

@functools.cache
def _project() -> AIProjectClient:
    return AIProjectClient(
        endpoint=os.environ["PROJECT_ENDPOINT"],
        credential=DefaultAzureCredential()
    )
    
def provision_agent(agent_name: str, instructions: str):
    _project().agents.create_version(
        agent_name=agent_name,
        definition=PromptAgentDefinition(
            model=os.environ["MODEL_DEPLOYMENT_NAME"],
            instructions=instructions
        )
    )
    
def upsert_agent(name: str, instructions: str) -> bool:
    """Create/update the agent only if missing or changed. Returns True if it wrote a new version."""
    proj = _project()
    model = os.environ["MODEL_DEPLOYMENT_NAME"]
    try:
        definition = proj.agents.get(agent_name=name)["versions"]["latest"]["definition"]
        if definition["instructions"] == instructions and definition["model"] == model:
            return False                    # unchanged — no version bump
    except ResourceNotFoundError:
        pass                                # doesn't exist — create it
    provision_agent(name, instructions)
    return True   
    
def run_agent(agent_name: str, user_input: str) -> dict:
    response = _project().get_openai_client(agent_name=agent_name).responses.create(input=user_input)
    text = response.output_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise ValueError(f"Agent {agent_name!r} returned non-JSON: {response.output_text!r}")

