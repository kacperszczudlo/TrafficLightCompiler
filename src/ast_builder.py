from typing import Any
from src.generated.TrafficLightVisitor import TrafficLightVisitor
from src.generated.TrafficLightParser import TrafficLightParser
from src.ast_nodes import IntersectionNode, StepNode, parse_duration_to_ms

class AstBuilderVisitor(TrafficLightVisitor):
    def visitProgram(self, ctx: TrafficLightParser.ProgramContext) -> IntersectionNode:
        return self.visit(ctx.intersection())

    def visitIntersection(self, ctx: TrafficLightParser.IntersectionContext) -> IntersectionNode:
        # STRING_LITERAL: '"Centrum_Pilsudskiego"' -> 'Centrum_Pilsudskiego'
        raw_name = ctx.STRING_LITERAL().getText()
        name = raw_name.strip('"')

        node = IntersectionNode(name=name, line=ctx.start.line)

        # directions
        node.directions = self.visit(ctx.directionsSection())

        # collisions (optional)
        if ctx.collisionsSection():
            node.collisions = self.visit(ctx.collisionsSection())
        else:
            node.collisions = []

        # cycle
        node.steps = self.visit(ctx.cycleSection())

        return node

    def visitDirectionsSection(self, ctx: TrafficLightParser.DirectionsSectionContext):
        directions = {}
        for d in ctx.directionDef():
            dir_name, dir_type = self.visit(d)
            directions[dir_name] = dir_type
        return directions

    def visitDirectionDef(self, ctx: TrafficLightParser.DirectionDefContext):
        name = ctx.ID().getText()
        sig_type = ctx.signalType().getText()
        return name, sig_type

    def visitCollisionsSection(self, ctx: TrafficLightParser.CollisionsSectionContext):
        collisions = []
        for c in ctx.collisionDef():
            pair = self.visit(c)
            collisions.append(pair)
        return collisions

    def visitCollisionDef(self, ctx: TrafficLightParser.CollisionDefContext):
        first = ctx.ID(0).getText()
        second = ctx.ID(1).getText()
        return first, second

    def visitCycleSection(self, ctx: TrafficLightParser.CycleSectionContext):
        steps = []
        for s in ctx.stepDef():
            step_node = self.visit(s)
            steps.append(step_node)
        return steps

    def visitStepDef(self, ctx: TrafficLightParser.StepDefContext):
        raw_time = ctx.TIME_LITERAL().getText()
        duration_ms = parse_duration_to_ms(raw_time)
        step = StepNode(
            duration_ms=duration_ms,
            duration_raw=raw_time,
            line=ctx.start.line
        )
        for sa in ctx.stateAssignment():
            dir_id, state = self.visit(sa)
            step.assignments[dir_id] = state
        return step

    def visitStateAssignment(self, ctx: TrafficLightParser.StateAssignmentContext):
        dir_id = ctx.ID().getText()
        state = ctx.lightState().getText()
        return dir_id, state
