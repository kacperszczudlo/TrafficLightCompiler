# Generated from grammar/TrafficLight.g4 by ANTLR 4.13.2
from antlr4 import *
if "." in __name__:
    from .TrafficLightParser import TrafficLightParser
else:
    from TrafficLightParser import TrafficLightParser

# This class defines a complete generic visitor for a parse tree produced by TrafficLightParser.

class TrafficLightVisitor(ParseTreeVisitor):

    # Visit a parse tree produced by TrafficLightParser#program.
    def visitProgram(self, ctx:TrafficLightParser.ProgramContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by TrafficLightParser#intersection.
    def visitIntersection(self, ctx:TrafficLightParser.IntersectionContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by TrafficLightParser#directionsSection.
    def visitDirectionsSection(self, ctx:TrafficLightParser.DirectionsSectionContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by TrafficLightParser#directionDef.
    def visitDirectionDef(self, ctx:TrafficLightParser.DirectionDefContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by TrafficLightParser#signalType.
    def visitSignalType(self, ctx:TrafficLightParser.SignalTypeContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by TrafficLightParser#collisionsSection.
    def visitCollisionsSection(self, ctx:TrafficLightParser.CollisionsSectionContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by TrafficLightParser#collisionDef.
    def visitCollisionDef(self, ctx:TrafficLightParser.CollisionDefContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by TrafficLightParser#cycleSection.
    def visitCycleSection(self, ctx:TrafficLightParser.CycleSectionContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by TrafficLightParser#stepDef.
    def visitStepDef(self, ctx:TrafficLightParser.StepDefContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by TrafficLightParser#stateAssignment.
    def visitStateAssignment(self, ctx:TrafficLightParser.StateAssignmentContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by TrafficLightParser#lightState.
    def visitLightState(self, ctx:TrafficLightParser.LightStateContext):
        return self.visitChildren(ctx)



del TrafficLightParser