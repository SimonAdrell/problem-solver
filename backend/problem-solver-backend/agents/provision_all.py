from agents.define_agent import provision as provision_define
from agents.solve_agent import provision as provision_solve
from agents.blueprint_agent import provision as provision_blueprint


def provision_all():
    for name, changed in [("define", provision_define()), ("solve", provision_solve()), ("blueprint", provision_blueprint())]:
        print(f"{name}: {'updated' if changed else 'unchanged'}")
        
        
if __name__ == "__main__":
    provision_all()