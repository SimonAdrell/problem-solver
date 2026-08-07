from agents.define_agent import provision as provision_define
from agents.solve_agent import provision as provision_solve


def provision_all():
    for name, changed in [("define", provision_define()), ("solve", provision_solve())]:
        print(f"{name}: {'updated' if changed else 'unchanged'}")
        
        
if __name__ == "__main__":
    provision_all()