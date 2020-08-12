<?php
/**
 * User file for "psysh"
 */

if (!function_exists('d')) {
    function d($data, $exit = false)
    {
        print_r($data);

        if ($exit) {
            exit;
        }

        return $data;
    }
}

if (!function_exists('read_clipboard')) {
    function read_clipboard() : string
    {
        $cliboardData = shell_exec('pbpaste');
        echo $cliboardData;
        return $cliboardData;
    }
}

if (!function_exists('write_clipboard')) {
    function write_clipboard($data, $arrayGlue=PHP_EOL) : void
    {
        if (is_array($data)) {
            $data = implode($arrayGlue, $data);
        }

        shell_exec("printf '$data' | pbcopy");
        echo 'Copied.';
    }
}

if (!function_exists('parse_clipboard')) {
    function parse_clipboard() : array
    {
        $cliboardData = read_clipboard();

        return d(explode(PHP_EOL, $cliboardData));
    }
}

if (!function_exists('f')) {
    function f ($data, $index, $body = null) {
        eval($body.';');
    }
}

if (!function_exists('inline_each')) {
    function inline_each(array $data, string $body) : void
    {
        array_walk($data, 'f', $body);
    }
}

if (!function_exists('frequency')) {
    function frequency(array $data) : array
    {
        $result = [];
        foreach ($data as $value) {
            $result[$value] = isset($result[$value]) ? $result[$value] + 1 : 1;
        }

        return d($result);
    }
}
