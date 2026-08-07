from agents.define_agent import define
from agents.solve_agent import solve

def solve_problem(problem: str) -> dict:
    brief = define(problem)
    proposal = solve(brief)
    return {"brief":brief, "proposal":proposal}

if __name__ == "__main__":
    import json
    print(json.dumps(solve_problem("All my images is a mess"),indent=2))
    
    