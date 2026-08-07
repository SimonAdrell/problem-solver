from agents.define_agent import define

def test_define_returns_brief():  
    brief = define("All my images is a mess")
    assert set(brief) >= {"core_problem", "persona", "inputs", "success_criteria"}
    assert brief["core_problem"]
    assert isinstance(brief["inputs"], list)