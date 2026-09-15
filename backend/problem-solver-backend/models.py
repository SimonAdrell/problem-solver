from extensions import db
from flask_security.models import fsqla_v3 as fsqla

fsqla.FsModels.set_db_info(db)

class Role(db.Model, fsqla.FsRoleMixin):
    pass


class User(db.Model, fsqla.FsUserMixin):
    pass

class Problem(db.Model):    
    id= db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(200), nullable=False, unique=True)
    problem_text = db.Column(db.Text, nullable=False)
    brief_json = db.Column(db.JSON)
    
    status = db.Column(
        db.String(30), nullable=False, default="generating"
    )
    
    created_at = db.Column(
        db.DateTime(timezone=True),nullable=False, server_default=db.func.now()
    )
    
    ideas = db.relationship(
        "Idea",
        back_populates="problem",
        order_by="Idea.position"
    )
    
class Idea(db.Model):    
    id = db.Column(db.Integer, primary_key=True)
    problem_id = db.Column(
        db.Integer, 
        db.ForeignKey("problem.id"),
        nullable=False
    )
    
    slug = db.Column(db.String(200), nullable=False)
    position = db.Column(db.Integer, nullable=False)
    idea_json = db.Column(db.JSON, nullable=False)

    blueprint_json = db.Column(db.JSON)
    image_key = db.Column(db.Text)

    blueprint_status = db.Column(
        db.String(30), nullable=False, default="not_started"
    )
    image_status = db.Column(
        db.String(30), nullable=False, default="not_started"
    )
    created_at = db.Column(
        db.DateTime(timezone=True), nullable=False, server_default=db.func.now()
    )

    problem = db.relationship("Problem", back_populates="ideas")

    __table_args__ = (
        db.UniqueConstraint(
            "problem_id", "slug", name="uq_idea_problem_slug"
        ),
        db.UniqueConstraint(
            "problem_id", "position", name="uq_idea_problem_position"
        ),
    )

