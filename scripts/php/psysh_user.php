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

if (!function_exists('x')) {
    function x($function, ...$params)
    {
        return call_user_func_array($function, $params);
    }
}

if (!function_exists('read_clipboard')) {
    function read_clipboard()
    {
        return shell_exec('pbpaste');
    }
}

if (!function_exists('write_clipboard')) {
    function write_clipboard($data, $arrayGlue = PHP_EOL)
    {
        if (is_array($data)) {
            $data = implode($arrayGlue, $data);
        }

        shell_exec(sprintf('printf %s | pbcopy', $data));

        return $data;
    }
}

if (!function_exists('parse_clipboard')) {
    function parse_clipboard() : array
    {
        $clipboardData = read_clipboard();

        return explode(PHP_EOL, $clipboardData);
    }
}

if (!function_exists('f')) {
    function f($data, $index, $body = null)
    {
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

        return $result;
    }
}

if (!function_exists('random_string')) {
    function random_string($length = 16)
    {
        $string = '';

        while (($len = strlen($string)) < $length) {
            $size = $length - $len;

            $bytes = random_bytes($size);

            $string .= substr(str_replace(['/', '+', '='], '', base64_encode($bytes)), 0, $size);
        }

        return $string;
    }
}
