Red []

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
