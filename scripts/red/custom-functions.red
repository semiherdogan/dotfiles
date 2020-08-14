Red []

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
