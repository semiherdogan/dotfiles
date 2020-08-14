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
    forall block [trim/all block/1]
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

cls: does [call/console pick ["cls" "clear"] system/platform = 'Windows exit]

parse-clipboard: has [
    "Parse Clipboard (Split from newline)"
][
    data: replace/all read-clipboard crlf lf
    split data either find data cr [cr][lf]
]

replace-clipboard: function [
    "Replaces given string in clipboard"
    find-value [char! string!]
    replace-value [char! string!]
] [
    write-clipboard replace/all read-clipboard find-value replace-value
]

; "Write unixtime to clipboard"
get-unixtime: does [
    write-clipboard to-string probe to-integer now
    print "Copied."
]

md5: function [
    "MD5"
    arg
][
    result: lowercase trim/with form checksum to-string arg 'MD5 "#{}"
    write-clipboard probe result
    print "Copied."
]

bcrypt: function [
    "Php Bcrypt"
    arg
][
    result: make string! 100
    call/output form reduce [{php -r "echo password_hash('} arg {', PASSWORD_BCRYPT);"}] result
    write-clipboard probe result
    print "Copied."
]

generate-string: function [
    "Generates random string"
    string-length [number!] "String length"
][
    random/seed now

    result: random copy/part random rejoin [
        "98765432"
        "ASDFGHJKLZXCVBNMQWERTYUP"
        "asdfghijkzxcvbnmqwertyup"
    ] string-length

    write-clipboard probe result
    print "Copied."
]

zip: function [
    "Combine two blocks"
    b1 [block!]
    b2 [block!]
    /pad "Include none values"
][
    temp: copy []
    repeat x max length? b1 length? b2 [
        if any [
            f1: pick b1 x
            pad
            not tail? at b1 x
        ] [append temp f1] if any [
            f2: pick b2 x
            pad
            not tail? at b2 x
        ] [append temp f2]
    ] temp
]

substitute: function [
    "Do variable substitution inside a string"
    string [any-string!]
    vars [object! block!]
][
    out: make string 2 + length? string
    emit: func [str] [insert tail out :str]
    rule: make block! 256
    if block? vars [vars: context vars]
    foreach word next first vars [
        insert tail rule compose/deep [
            (either empty? rule [] ['|])
            (form word) ">" (to paren! bind compose [emit (word)] in vars 'self)
        ]
    ]
    parse/all string [
        any [
            start:
            to "<" end: (insert/part tail out start end)
            ["<" rule | skip (emit "<")]
        ]
        (insert tail out start)
    ]
    out
]

; https://github.com/red/red/wiki/[DOC]-Guru-Meditations#how-to-make-http-requests
http-post: function [
    "Make Http POST request"
    url [url!]
    parameters [string!]
    /headers
        http-headers [block!]
    /info
] [
    unless headers [http-headers: []]

    either info [
        write/info url reduce ['POST http-headers parameters]
    ][
        write url reduce ['POST http-headers parameters]
    ]
]

run-console: function [
    "Runs shell command and returns output"
    command [string!]
][
    o: copy ""
    call/console/output reduce command o
    o
]


map-sql-params: function [
    "Maps SQL parameters and Red values"
    data [block!]
][
    args:         reduce next data
    sql:          copy to-string reduce pick data 1
    mark:         sql
    with-zero:    charset "0987654321"
    without-zero: charset "987654321"

    while [mark: find mark #"?"][
        mark: insert remove mark either any [tail? args][
            "NULL"
        ][
            either parse form args/1 [without-zero any with-zero | "0" | "NULL"]
            [
                args/1
            ][
                replace/all args/1 {'} {\'}
                rejoin ["'" args/1 "'"]
            ]
        ]

        if not tail? args [args: next args]
    ]
    sql
]

sql-insert: has [
    "Creates sql insert queries for given data"
] [
    table-name: ask "Table name? "
    if (length? table-name) = 0 [
        table-name: "<table>"
    ]

    table-name: rejoin ["`" table-name "`"]

    data: parse-clipboard

    headers: split copy data/1 tab
    remove/part data 1

    result: []

    forall data [
        row: split (replace/all data/1 "'" "\'") tab

        append result rejoin [
            "INSERT INTO "
            table-name " "
            "(`" merge/with headers "`, `" "`)"
            " VALUES "
            "('" merge/with row "', '" "');"
        ]
    ]

    print [result/1 newline "..."]

    write-clipboard merge/with result newline

    print "Copied!"
]

sql-update: has [
    "Creates sql update queries for given data"
] [
    table-name: ask "Table name? "
    if (length? table-name) = 0 [
        table-name: "<table>"
    ]

    data: parse-clipboard

    headers: split copy data/1 tab
    remove/part data 1

    repeat i length? headers [
        print merge/with reduce [i ") " headers/:i] ""
    ]

    where-ids: split ask "Field indexes to add to WHERE (comma separated): " comma

    result: []
    forall data [
        row: split data/1 tab
        sql: copy ""
        sql: rejoin reduce ["UPDATE " table-name " SET "]
        repeat row-index length? row [
            unless find where-ids to-string row-index [
                append sql rejoin [
                    "`" trim headers/:row-index "`"
                    map-sql-params ["=?, " trim row/:row-index]
                ]
            ]
        ]

        remove back tail sql
        remove back tail sql

        append sql " WHERE "

        repeat header-index length? headers [
            if find where-ids to-string header-index [
                append sql rejoin [
                    "`" trim headers/:header-index "`"
                    map-sql-params ["=? AND " trim row/:header-index]
                ]
            ]
        ]

        loop 5 [remove back tail sql]

        append sql ";"

        append result sql
        prin "."
    ]

    print [newline result/1 "..." newline]

    write-clipboard merge/with result newline

    print "Copied."
]

sql-insert-bulk: has [
    "Creates bulk sql insert queries for given data"
] [
    ; table-name
    table-name: ask "Table name? "
    if (length? table-name) = 0 [
        table-name: "<table>"
    ]
    table-name: rejoin ["`" table-name "`"]

    ; bulk-length
    bulk-length: ask "Bulk length[1000]? "
    if (length? bulk-length) = 0 [
        bulk-length: 1000
    ]
    bulk-length: to-integer bulk-length

    data: parse-clipboard

    headers: split copy data/1 tab
    remove/part data 1

    data-for-insert: copy []

    forall data [
        row: split data/1 tab

        params: reduce [merge/with fill "?" length? row ", "]

        forall row [append params row/1]

        append data-for-insert (map-sql-params params)
    ]

    sql: rejoin[
        "INSERT INTO " table-name " ^/"
        "(`" merge/with headers "`, `" "`)"
        "^/ VALUES ^/"
    ]

    result: copy []

    either (length? data-for-insert) > bulk-length [
        temp-sql: copy sql

        repeat i length? data-for-insert [
            ;
            append temp-sql rejoin [
                "(" data-for-insert/:i "),^/"
            ]

            if any [((mod i bulk-length) = 0) (i = (length? data-for-insert))] [
                loop 2 [remove back tail temp-sql]
                append temp-sql ";^/^/"

                append result temp-sql

                temp-sql: copy sql
            ]
        ]
    ] [
        append result rejoin [sql "(" merge/with data-for-insert "),^/(" ");"]
    ]

    print [result/1 "..."]

    write-clipboard rejoin result

    print "Copied!"
]


range: func [
    start      [number!]
    end        [number!]
    step       [number!]
    return:    [block!]
    /local
        result [block!]
][
    result: copy []

    until [
        append result start
        start: start + step
        start > end
    ]

    result
]

..: make op! func [
    start   [number!]
    end     [number!]
    return: [block!]
][
    range start end 1
]

...: make op! func [
    start   [number!]
    end     [number!]
    return: [block!]
][
    range start end 0.1
]


rand: func [
    return:    [any-type!]
    /range
        min    [number!]
        max    [number!]
    /only
        series [series!]
][
    random/seed to-integer now

    either range [min + random (max - min)][
        either only [random/only series][random/only 0 ... 1]
    ]
]


without: func [
  series     [series!]
  values     [block!]
  return:    [series!]
  /local
      result [series!]
      found  [series!]
      value
][
  result: copy/deep series

  foreach value values [
    found: find/case result value
    if found [
      loop length? value [remove found]
    ]
  ]

  result
]


flatten: func [
    block      [block!]
    return:    [block!]
    /local
        result [block!]
        value
][
    result: copy []

    foreach value block [
        either block? value [repend result flatten value][append result value]
    ]

    result
]

pt-to-px: func[
    pt [integer!]
] [
    return to-integer round pt * 1.3333
]


