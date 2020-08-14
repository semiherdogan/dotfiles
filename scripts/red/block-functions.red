Red []

merge: function [
    "Merge block"
    b [block!]
    /with c
    /quot
][
    c: any [c ","]
    if quot [c: rejoin ["'" c "'"]]
    s: copy ""
    s: head clear skip foreach v b [insert tail s rejoin [form v c]] negate length? to-string c
    if quot [
        s: rejoin ["'" s "'"]
    ]
    s
]

nl: function [
    "Prints block elemnents with newline by given number"
    block [block!]
    num [integer!]
    /local i
][
    ; new-line/all/skip block true num
    i: 1
    foreach v block [
        prin v prin space
        if i = num [print "" i: 0]
        i: i + 1
    ]
]

trim-each: function [
    "Trim all values in block"
    block [block!]
] [
    forall block [trim block/1]
]

append-each: function [
    "Appends given string to all values in block"
    block [block!]
    append-value [char! string! integer!]
] [
    forall block [block/1: rejoin[block/1 append-value]]
]

prepend-each: function [
    "Prepends given string to all values in block"
    block [block!]
    prepend-value [char! string! integer!]
] [
    forall block [block/1: rejoin[prepend-value block/1]]
]

replace-each: function [
    "Replaces given string from all values in block"
    block [block!]
    find-value [char! string!]
    replace-value [char! string!]
] [
    forall block [block/1: replace/all block/1 find-value replace-value]
]

collect-each: function [
    "Reverse version of remove-each"
    'word [word!]
    series [block!]
    body [block!]
] [
    collect [
        foreach w series [
            set word w
            set/any 'value do body
            if all [value? 'value value] [
                keep w
            ]
        ]
    ]
]

inline-each: function [
    "Loops through all values in given block and evualetes given body with value"
    'word [word!]
    series [block!]
    body [block!]
] [
    forall series [
        set word series/1
        do body
    ]
]

frequency: function [
    "Returns count of dublicated values in block"
    data [block!]
    /return-data
][
    result: copy #()
    foreach value data [
        result/:value: either result/:value [result/:value + 1][1]
    ]

    either return-data [
        result
    ] [
        nl sort/reverse/skip reverse to-block result 2 2
    ]
]

find-duplicates: function [
    "Find duplicates in block"
    b [block!]
    /all
    /show-dots
][
    o: copy []
    forall b [
        if find next b b/1 [
            unless all [
                return b
            ]
            append o b/1
        ]
        if show-dots [prin "."]
    ]
    if show-dots [print ""]

    unique o
]

parse-tab-separated: function [
    "Parses tab separated data"
    'row [word!]
    body [block!]
    /data
        given-data [string!]
][
    unless data [given-data: read-clipboard]

    given-data: split given-data newline

    forall given-data [
        set row split given-data/1 tab
        do body
    ]
]
