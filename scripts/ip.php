<?php

if (!isset($argv[1])) {
    echo 'My ip: '.shell_exec('dig +short myip.opendns.com @resolver1.opendns.com');
} else {
    $result = gethostbyname($argv[1]);

    if ($result === $argv[1]) {
        $result = 'Not found.';
    }

    echo 'Ip of "'.$argv[1].'": '.$result.PHP_EOL;
}
