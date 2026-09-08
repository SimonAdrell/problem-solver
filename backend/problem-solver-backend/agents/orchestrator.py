from agents.define_agent import define
from agents.solve_agent import solve

def solve_problem(problem: str) -> dict:
    brief = define(problem)
    result = solve(brief)
    if not isinstance(result.get("ideas"), list):
        raise ValueError("solve agent returned no ideas")
    return {"brief": brief, "ideas": result["ideas"]}

if __name__ == "__main__":
    import json
    print(json.dumps(solve_problem("All my images is a mess"),indent=2))