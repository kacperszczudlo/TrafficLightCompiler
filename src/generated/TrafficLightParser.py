# Generated from grammar/TrafficLight.g4 by ANTLR 4.13.2
# encoding: utf-8
from antlr4 import *
from io import StringIO
import sys
if sys.version_info[1] > 5:
	from typing import TextIO
else:
	from typing.io import TextIO

def serializedATN():
    return [
        4,1,38,100,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,7,
        6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,1,0,1,0,1,0,1,1,1,1,1,1,1,1,
        1,1,3,1,31,8,1,1,1,1,1,1,1,1,2,1,2,1,2,5,2,39,8,2,10,2,12,2,42,9,
        2,1,2,1,2,1,3,1,3,1,3,1,3,1,3,1,4,1,4,1,5,1,5,1,5,5,5,56,8,5,10,
        5,12,5,59,9,5,1,5,1,5,1,6,1,6,1,6,1,6,1,6,1,7,1,7,1,7,5,7,71,8,7,
        10,7,12,7,74,9,7,1,7,1,7,1,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,5,8,86,
        8,8,10,8,12,8,89,9,8,1,8,1,8,1,9,1,9,1,9,1,9,1,9,1,10,1,10,1,10,
        0,0,11,0,2,4,6,8,10,12,14,16,18,20,0,2,1,0,7,12,1,0,20,32,93,0,22,
        1,0,0,0,2,25,1,0,0,0,4,35,1,0,0,0,6,45,1,0,0,0,8,50,1,0,0,0,10,52,
        1,0,0,0,12,62,1,0,0,0,14,67,1,0,0,0,16,77,1,0,0,0,18,92,1,0,0,0,
        20,97,1,0,0,0,22,23,3,2,1,0,23,24,5,0,0,1,24,1,1,0,0,0,25,26,5,1,
        0,0,26,27,5,34,0,0,27,28,5,2,0,0,28,30,3,4,2,0,29,31,3,10,5,0,30,
        29,1,0,0,0,30,31,1,0,0,0,31,32,1,0,0,0,32,33,3,14,7,0,33,34,5,3,
        0,0,34,3,1,0,0,0,35,36,5,4,0,0,36,40,5,2,0,0,37,39,3,6,3,0,38,37,
        1,0,0,0,39,42,1,0,0,0,40,38,1,0,0,0,40,41,1,0,0,0,41,43,1,0,0,0,
        42,40,1,0,0,0,43,44,5,3,0,0,44,5,1,0,0,0,45,46,5,35,0,0,46,47,5,
        5,0,0,47,48,3,8,4,0,48,49,5,6,0,0,49,7,1,0,0,0,50,51,7,0,0,0,51,
        9,1,0,0,0,52,53,5,13,0,0,53,57,5,2,0,0,54,56,3,12,6,0,55,54,1,0,
        0,0,56,59,1,0,0,0,57,55,1,0,0,0,57,58,1,0,0,0,58,60,1,0,0,0,59,57,
        1,0,0,0,60,61,5,3,0,0,61,11,1,0,0,0,62,63,5,35,0,0,63,64,5,14,0,
        0,64,65,5,35,0,0,65,66,5,6,0,0,66,13,1,0,0,0,67,68,5,15,0,0,68,72,
        5,2,0,0,69,71,3,16,8,0,70,69,1,0,0,0,71,74,1,0,0,0,72,70,1,0,0,0,
        72,73,1,0,0,0,73,75,1,0,0,0,74,72,1,0,0,0,75,76,5,3,0,0,76,15,1,
        0,0,0,77,78,5,16,0,0,78,79,5,17,0,0,79,80,5,18,0,0,80,81,5,5,0,0,
        81,82,5,33,0,0,82,83,5,19,0,0,83,87,5,2,0,0,84,86,3,18,9,0,85,84,
        1,0,0,0,86,89,1,0,0,0,87,85,1,0,0,0,87,88,1,0,0,0,88,90,1,0,0,0,
        89,87,1,0,0,0,90,91,5,3,0,0,91,17,1,0,0,0,92,93,5,35,0,0,93,94,5,
        5,0,0,94,95,3,20,10,0,95,96,5,6,0,0,96,19,1,0,0,0,97,98,7,1,0,0,
        98,21,1,0,0,0,5,30,40,57,72,87
    ]

class TrafficLightParser ( Parser ):

    grammarFileName = "TrafficLight.g4"

    atn = ATNDeserializer().deserialize(serializedATN())

    decisionsToDFA = [ DFA(ds, i) for i, ds in enumerate(atn.decisionToState) ]

    sharedContextCache = PredictionContextCache()

    literalNames = [ "<INVALID>", "'skrzyzowanie'", "'{'", "'}'", "'kierunki'", 
                     "':'", "';'", "'pojazdy'", "'samochody'", "'piesi'", 
                     "'tramwaje'", "'kolej'", "'rowery'", "'kolizje'", "'<->'", 
                     "'cykl'", "'krok'", "'('", "'czas'", "')'", "'CZERWONE'", 
                     "'CZERWONE_ZOLTE'", "'ZIELONE'", "'ZOLTE'", "'ZOLTE_MIGAJACE'", 
                     "'WYLACZONE'", "'ZIELONE_MIGAJACE'", "'TRAM_STOJ'", 
                     "'TRAM_JAZDA'", "'TRAM_UWAGA'", "'PRZEJAZD_OTWARTY'", 
                     "'PRZEJAZD_OSTRZEZENIE'", "'PRZEJAZD_ZAMKNIETY'" ]

    symbolicNames = [ "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "<INVALID>", "<INVALID>", "<INVALID>", 
                      "<INVALID>", "TIME_LITERAL", "STRING_LITERAL", "ID", 
                      "COMMENT_LINE", "COMMENT_BLOCK", "WS" ]

    RULE_program = 0
    RULE_intersection = 1
    RULE_directionsSection = 2
    RULE_directionDef = 3
    RULE_signalType = 4
    RULE_collisionsSection = 5
    RULE_collisionDef = 6
    RULE_cycleSection = 7
    RULE_stepDef = 8
    RULE_stateAssignment = 9
    RULE_lightState = 10

    ruleNames =  [ "program", "intersection", "directionsSection", "directionDef", 
                   "signalType", "collisionsSection", "collisionDef", "cycleSection", 
                   "stepDef", "stateAssignment", "lightState" ]

    EOF = Token.EOF
    T__0=1
    T__1=2
    T__2=3
    T__3=4
    T__4=5
    T__5=6
    T__6=7
    T__7=8
    T__8=9
    T__9=10
    T__10=11
    T__11=12
    T__12=13
    T__13=14
    T__14=15
    T__15=16
    T__16=17
    T__17=18
    T__18=19
    T__19=20
    T__20=21
    T__21=22
    T__22=23
    T__23=24
    T__24=25
    T__25=26
    T__26=27
    T__27=28
    T__28=29
    T__29=30
    T__30=31
    T__31=32
    TIME_LITERAL=33
    STRING_LITERAL=34
    ID=35
    COMMENT_LINE=36
    COMMENT_BLOCK=37
    WS=38

    def __init__(self, input:TokenStream, output:TextIO = sys.stdout):
        super().__init__(input, output)
        self.checkVersion("4.13.2")
        self._interp = ParserATNSimulator(self, self.atn, self.decisionsToDFA, self.sharedContextCache)
        self._predicates = None




    class ProgramContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def intersection(self):
            return self.getTypedRuleContext(TrafficLightParser.IntersectionContext,0)


        def EOF(self):
            return self.getToken(TrafficLightParser.EOF, 0)

        def getRuleIndex(self):
            return TrafficLightParser.RULE_program

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterProgram" ):
                listener.enterProgram(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitProgram" ):
                listener.exitProgram(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitProgram" ):
                return visitor.visitProgram(self)
            else:
                return visitor.visitChildren(self)




    def program(self):

        localctx = TrafficLightParser.ProgramContext(self, self._ctx, self.state)
        self.enterRule(localctx, 0, self.RULE_program)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 22
            self.intersection()
            self.state = 23
            self.match(TrafficLightParser.EOF)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class IntersectionContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def STRING_LITERAL(self):
            return self.getToken(TrafficLightParser.STRING_LITERAL, 0)

        def directionsSection(self):
            return self.getTypedRuleContext(TrafficLightParser.DirectionsSectionContext,0)


        def cycleSection(self):
            return self.getTypedRuleContext(TrafficLightParser.CycleSectionContext,0)


        def collisionsSection(self):
            return self.getTypedRuleContext(TrafficLightParser.CollisionsSectionContext,0)


        def getRuleIndex(self):
            return TrafficLightParser.RULE_intersection

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterIntersection" ):
                listener.enterIntersection(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitIntersection" ):
                listener.exitIntersection(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitIntersection" ):
                return visitor.visitIntersection(self)
            else:
                return visitor.visitChildren(self)




    def intersection(self):

        localctx = TrafficLightParser.IntersectionContext(self, self._ctx, self.state)
        self.enterRule(localctx, 2, self.RULE_intersection)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 25
            self.match(TrafficLightParser.T__0)
            self.state = 26
            self.match(TrafficLightParser.STRING_LITERAL)
            self.state = 27
            self.match(TrafficLightParser.T__1)
            self.state = 28
            self.directionsSection()
            self.state = 30
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            if _la==13:
                self.state = 29
                self.collisionsSection()


            self.state = 32
            self.cycleSection()
            self.state = 33
            self.match(TrafficLightParser.T__2)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DirectionsSectionContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def directionDef(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(TrafficLightParser.DirectionDefContext)
            else:
                return self.getTypedRuleContext(TrafficLightParser.DirectionDefContext,i)


        def getRuleIndex(self):
            return TrafficLightParser.RULE_directionsSection

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDirectionsSection" ):
                listener.enterDirectionsSection(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDirectionsSection" ):
                listener.exitDirectionsSection(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitDirectionsSection" ):
                return visitor.visitDirectionsSection(self)
            else:
                return visitor.visitChildren(self)




    def directionsSection(self):

        localctx = TrafficLightParser.DirectionsSectionContext(self, self._ctx, self.state)
        self.enterRule(localctx, 4, self.RULE_directionsSection)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 35
            self.match(TrafficLightParser.T__3)
            self.state = 36
            self.match(TrafficLightParser.T__1)
            self.state = 40
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while _la==35:
                self.state = 37
                self.directionDef()
                self.state = 42
                self._errHandler.sync(self)
                _la = self._input.LA(1)

            self.state = 43
            self.match(TrafficLightParser.T__2)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class DirectionDefContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def ID(self):
            return self.getToken(TrafficLightParser.ID, 0)

        def signalType(self):
            return self.getTypedRuleContext(TrafficLightParser.SignalTypeContext,0)


        def getRuleIndex(self):
            return TrafficLightParser.RULE_directionDef

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterDirectionDef" ):
                listener.enterDirectionDef(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitDirectionDef" ):
                listener.exitDirectionDef(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitDirectionDef" ):
                return visitor.visitDirectionDef(self)
            else:
                return visitor.visitChildren(self)




    def directionDef(self):

        localctx = TrafficLightParser.DirectionDefContext(self, self._ctx, self.state)
        self.enterRule(localctx, 6, self.RULE_directionDef)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 45
            self.match(TrafficLightParser.ID)
            self.state = 46
            self.match(TrafficLightParser.T__4)
            self.state = 47
            self.signalType()
            self.state = 48
            self.match(TrafficLightParser.T__5)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class SignalTypeContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser


        def getRuleIndex(self):
            return TrafficLightParser.RULE_signalType

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterSignalType" ):
                listener.enterSignalType(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitSignalType" ):
                listener.exitSignalType(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitSignalType" ):
                return visitor.visitSignalType(self)
            else:
                return visitor.visitChildren(self)




    def signalType(self):

        localctx = TrafficLightParser.SignalTypeContext(self, self._ctx, self.state)
        self.enterRule(localctx, 8, self.RULE_signalType)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 50
            _la = self._input.LA(1)
            if not((((_la) & ~0x3f) == 0 and ((1 << _la) & 8064) != 0)):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class CollisionsSectionContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def collisionDef(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(TrafficLightParser.CollisionDefContext)
            else:
                return self.getTypedRuleContext(TrafficLightParser.CollisionDefContext,i)


        def getRuleIndex(self):
            return TrafficLightParser.RULE_collisionsSection

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterCollisionsSection" ):
                listener.enterCollisionsSection(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitCollisionsSection" ):
                listener.exitCollisionsSection(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitCollisionsSection" ):
                return visitor.visitCollisionsSection(self)
            else:
                return visitor.visitChildren(self)




    def collisionsSection(self):

        localctx = TrafficLightParser.CollisionsSectionContext(self, self._ctx, self.state)
        self.enterRule(localctx, 10, self.RULE_collisionsSection)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 52
            self.match(TrafficLightParser.T__12)
            self.state = 53
            self.match(TrafficLightParser.T__1)
            self.state = 57
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while _la==35:
                self.state = 54
                self.collisionDef()
                self.state = 59
                self._errHandler.sync(self)
                _la = self._input.LA(1)

            self.state = 60
            self.match(TrafficLightParser.T__2)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class CollisionDefContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def ID(self, i:int=None):
            if i is None:
                return self.getTokens(TrafficLightParser.ID)
            else:
                return self.getToken(TrafficLightParser.ID, i)

        def getRuleIndex(self):
            return TrafficLightParser.RULE_collisionDef

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterCollisionDef" ):
                listener.enterCollisionDef(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitCollisionDef" ):
                listener.exitCollisionDef(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitCollisionDef" ):
                return visitor.visitCollisionDef(self)
            else:
                return visitor.visitChildren(self)




    def collisionDef(self):

        localctx = TrafficLightParser.CollisionDefContext(self, self._ctx, self.state)
        self.enterRule(localctx, 12, self.RULE_collisionDef)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 62
            self.match(TrafficLightParser.ID)
            self.state = 63
            self.match(TrafficLightParser.T__13)
            self.state = 64
            self.match(TrafficLightParser.ID)
            self.state = 65
            self.match(TrafficLightParser.T__5)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class CycleSectionContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def stepDef(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(TrafficLightParser.StepDefContext)
            else:
                return self.getTypedRuleContext(TrafficLightParser.StepDefContext,i)


        def getRuleIndex(self):
            return TrafficLightParser.RULE_cycleSection

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterCycleSection" ):
                listener.enterCycleSection(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitCycleSection" ):
                listener.exitCycleSection(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitCycleSection" ):
                return visitor.visitCycleSection(self)
            else:
                return visitor.visitChildren(self)




    def cycleSection(self):

        localctx = TrafficLightParser.CycleSectionContext(self, self._ctx, self.state)
        self.enterRule(localctx, 14, self.RULE_cycleSection)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 67
            self.match(TrafficLightParser.T__14)
            self.state = 68
            self.match(TrafficLightParser.T__1)
            self.state = 72
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while _la==16:
                self.state = 69
                self.stepDef()
                self.state = 74
                self._errHandler.sync(self)
                _la = self._input.LA(1)

            self.state = 75
            self.match(TrafficLightParser.T__2)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class StepDefContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def TIME_LITERAL(self):
            return self.getToken(TrafficLightParser.TIME_LITERAL, 0)

        def stateAssignment(self, i:int=None):
            if i is None:
                return self.getTypedRuleContexts(TrafficLightParser.StateAssignmentContext)
            else:
                return self.getTypedRuleContext(TrafficLightParser.StateAssignmentContext,i)


        def getRuleIndex(self):
            return TrafficLightParser.RULE_stepDef

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterStepDef" ):
                listener.enterStepDef(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitStepDef" ):
                listener.exitStepDef(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitStepDef" ):
                return visitor.visitStepDef(self)
            else:
                return visitor.visitChildren(self)




    def stepDef(self):

        localctx = TrafficLightParser.StepDefContext(self, self._ctx, self.state)
        self.enterRule(localctx, 16, self.RULE_stepDef)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 77
            self.match(TrafficLightParser.T__15)
            self.state = 78
            self.match(TrafficLightParser.T__16)
            self.state = 79
            self.match(TrafficLightParser.T__17)
            self.state = 80
            self.match(TrafficLightParser.T__4)
            self.state = 81
            self.match(TrafficLightParser.TIME_LITERAL)
            self.state = 82
            self.match(TrafficLightParser.T__18)
            self.state = 83
            self.match(TrafficLightParser.T__1)
            self.state = 87
            self._errHandler.sync(self)
            _la = self._input.LA(1)
            while _la==35:
                self.state = 84
                self.stateAssignment()
                self.state = 89
                self._errHandler.sync(self)
                _la = self._input.LA(1)

            self.state = 90
            self.match(TrafficLightParser.T__2)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class StateAssignmentContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser

        def ID(self):
            return self.getToken(TrafficLightParser.ID, 0)

        def lightState(self):
            return self.getTypedRuleContext(TrafficLightParser.LightStateContext,0)


        def getRuleIndex(self):
            return TrafficLightParser.RULE_stateAssignment

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterStateAssignment" ):
                listener.enterStateAssignment(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitStateAssignment" ):
                listener.exitStateAssignment(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitStateAssignment" ):
                return visitor.visitStateAssignment(self)
            else:
                return visitor.visitChildren(self)




    def stateAssignment(self):

        localctx = TrafficLightParser.StateAssignmentContext(self, self._ctx, self.state)
        self.enterRule(localctx, 18, self.RULE_stateAssignment)
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 92
            self.match(TrafficLightParser.ID)
            self.state = 93
            self.match(TrafficLightParser.T__4)
            self.state = 94
            self.lightState()
            self.state = 95
            self.match(TrafficLightParser.T__5)
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx


    class LightStateContext(ParserRuleContext):
        __slots__ = 'parser'

        def __init__(self, parser, parent:ParserRuleContext=None, invokingState:int=-1):
            super().__init__(parent, invokingState)
            self.parser = parser


        def getRuleIndex(self):
            return TrafficLightParser.RULE_lightState

        def enterRule(self, listener:ParseTreeListener):
            if hasattr( listener, "enterLightState" ):
                listener.enterLightState(self)

        def exitRule(self, listener:ParseTreeListener):
            if hasattr( listener, "exitLightState" ):
                listener.exitLightState(self)

        def accept(self, visitor:ParseTreeVisitor):
            if hasattr( visitor, "visitLightState" ):
                return visitor.visitLightState(self)
            else:
                return visitor.visitChildren(self)




    def lightState(self):

        localctx = TrafficLightParser.LightStateContext(self, self._ctx, self.state)
        self.enterRule(localctx, 20, self.RULE_lightState)
        self._la = 0 # Token type
        try:
            self.enterOuterAlt(localctx, 1)
            self.state = 97
            _la = self._input.LA(1)
            if not((((_la) & ~0x3f) == 0 and ((1 << _la) & 8588886016) != 0)):
                self._errHandler.recoverInline(self)
            else:
                self._errHandler.reportMatch(self)
                self.consume()
        except RecognitionException as re:
            localctx.exception = re
            self._errHandler.reportError(self, re)
            self._errHandler.recover(self, re)
        finally:
            self.exitRule()
        return localctx





