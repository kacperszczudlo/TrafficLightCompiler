grammar TrafficLight;

// ==========================================
// REGULY PARSERA
// ==========================================

program
    : intersection EOF
    ;

intersection
    : 'skrzyzowanie' STRING_LITERAL '{'
        directionsSection
        collisionsSection?
        cycleSection
      '}'
    ;

directionsSection
    : 'kierunki' '{' directionDef* '}'
    ;

directionDef
    : ID ':' signalType ';'
    ;

signalType
    : 'pojazdy'
    | 'piesi'
    ;

collisionsSection
    : 'kolizje' '{' collisionDef* '}'
    ;

collisionDef
    : ID '<->' ID ';'
    ;

cycleSection
    : 'cykl' '{' stepDef* '}'
    ;

stepDef
    : 'krok' '(' 'czas' ':' TIME_LITERAL ')' '{'
        stateAssignment*
      '}'
    ;

stateAssignment
    : ID ':' lightState ';'
    ;

lightState
    : 'CZERWONE'
    | 'CZERWONE_ZOLTE'
    | 'ZIELONE'
    | 'ZOLTE'
    | 'ZOLTE_MIGAJACE'
    | 'WYLACZONE'
    ;

// ==========================================
// REGULY LEKSERA
// ==========================================

TIME_LITERAL
    : [0-9]+ ('ms' | 's' | 'm')
    ;

STRING_LITERAL
    : '"' (~["\\] | '\\' .)* '"'
    ;

ID
    : [a-zA-Z_][a-zA-Z0-9_]*
    ;

COMMENT_LINE
    : '//' ~[\r\n]* -> skip
    ;

COMMENT_BLOCK
    : '/*' .*? '*/' -> skip
    ;

WS
    : [ \t\r\n]+ -> skip
    ;
