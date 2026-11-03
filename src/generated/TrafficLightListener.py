# Generated from grammar/TrafficLight.g4 by ANTLR 4.13.2
from antlr4 import *
if "." in __name__:
    from .TrafficLightParser import TrafficLightParser
else:
    from TrafficLightParser import TrafficLightParser

# This class defines a complete listener for a parse tree produced by TrafficLightParser.
class TrafficLightListener(ParseTreeListener):

    # Enter a parse tree produced by TrafficLightParser#program.
    def enterProgram(self, ctx:TrafficLightParser.ProgramContext):
        pass

    # Exit a parse tree produced by TrafficLightParser#program.
    def exitProgram(self, ctx:TrafficLightParser.ProgramContext):
        pass


    # Enter a parse tree produced by TrafficLightParser#intersection.
    def enterIntersection(self, ctx:TrafficLightParser.IntersectionContext):
        pass

    # Exit a parse tree produced by TrafficLightParser#intersection.
    def exitIntersection(self, ctx:TrafficLightParser.IntersectionContext):
        pass


    # Enter a parse tree produced by TrafficLightParser#directionsSection.
    def enterDirectionsSection(self, ctx:TrafficLightParser.DirectionsSectionContext):
        pass

    # Exit a parse tree produced by TrafficLightParser#directionsSection.
    def exitDirectionsSection(self, ctx:TrafficLightParser.DirectionsSectionContext):
        pass


    # Enter a parse tree produced by TrafficLightParser#directionDef.
    def enterDirectionDef(self, ctx:TrafficLightParser.DirectionDefContext):
        pass

    # Exit a parse tree produced by TrafficLightParser#directionDef.
    def exitDirectionDef(self, ctx:TrafficLightParser.DirectionDefContext):
        pass


    # Enter a parse tree produced by TrafficLightParser#signalType.
    def enterSignalType(self, ctx:TrafficLightParser.SignalTypeContext):
        pass

    # Exit a parse tree produced by TrafficLightParser#signalType.
    def exitSignalType(self, ctx:TrafficLightParser.SignalTypeContext):
        pass


    # Enter a parse tree produced by TrafficLightParser#collisionsSection.
    def enterCollisionsSection(self, ctx:TrafficLightParser.CollisionsSectionContext):
        pass

    # Exit a parse tree produced by TrafficLightParser#collisionsSection.
    def exitCollisionsSection(self, ctx:TrafficLightParser.CollisionsSectionContext):
        pass


    # Enter a parse tree produced by TrafficLightParser#collisionDef.
    def enterCollisionDef(self, ctx:TrafficLightParser.CollisionDefContext):
        pass

    # Exit a parse tree produced by TrafficLightParser#collisionDef.
    def exitCollisionDef(self, ctx:TrafficLightParser.CollisionDefContext):
        pass


    # Enter a parse tree produced by TrafficLightParser#cycleSection.
    def enterCycleSection(self, ctx:TrafficLightParser.CycleSectionContext):
        pass

    # Exit a parse tree produced by TrafficLightParser#cycleSection.
    def exitCycleSection(self, ctx:TrafficLightParser.CycleSectionContext):
        pass


    # Enter a parse tree produced by TrafficLightParser#stepDef.
    def enterStepDef(self, ctx:TrafficLightParser.StepDefContext):
        pass

    # Exit a parse tree produced by TrafficLightParser#stepDef.
    def exitStepDef(self, ctx:TrafficLightParser.StepDefContext):
        pass


    # Enter a parse tree produced by TrafficLightParser#stateAssignment.
    def enterStateAssignment(self, ctx:TrafficLightParser.StateAssignmentContext):
        pass

    # Exit a parse tree produced by TrafficLightParser#stateAssignment.
    def exitStateAssignment(self, ctx:TrafficLightParser.StateAssignmentContext):
        pass


    # Enter a parse tree produced by TrafficLightParser#lightState.
    def enterLightState(self, ctx:TrafficLightParser.LightStateContext):
        pass

    # Exit a parse tree produced by TrafficLightParser#lightState.
    def exitLightState(self, ctx:TrafficLightParser.LightStateContext):
        pass



del TrafficLightParser