<?php
/**
 * User file for "psysh"
 */

date_default_timezone_set('Europe/Istanbul');

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

if (!function_exists('f')) {
    function f($function, ...$params)
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

        exec(sprintf("echo %s | pbcopy", escapeshellarg($data)));

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

if (!function_exists('each')) {
    function each(array $data, string $body) : void
    {
        foreach ($data as $index => $value) {
            eval($body.';');
        }
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

if (!function_exists('generate_password')) {
    function generate_password($length = 16, $addSpecialCharacters = true)
    {
        $charsets = [
            '98765432',
            'ASDFGHJKLZXCVBNMQWERTYUP',
            'asdfghijkzxcvbnmqwertyup',
        ];

        if ($addSpecialCharacters) {
            $charsets[] = '-+%&?!()=';
        }

        $result = '';

        foreach ($charsets as $charset) {
            $result .= substr($charset, rand(0, strlen($charset) - 1), 1);

            if (strlen($result) >= $length) {
                break;
            }
        }

        $allCharacters = implode('', $charsets);

        while (strlen($result) < $length) {
            $result .= substr($allCharacters, rand(0, strlen($allCharacters) - 1), 1);
        }

        return $result;
    }
}

if (!function_exists('rgb_to_hex')) {
    function rgb_to_hex() {
        $rgb = read_clipboard();

        $remove = ['rgb', '(', ')'];
        foreach ($remove as $r) {
            $rgb = str_replace($r, '', $rgb);
        }

        $rgb = trim($rgb);

        $characters = [',', ' ', "\t"];

        foreach ($characters as $character) {
            if (strpos($rgb, $character) !== false) {
                $rgb = explode($character, $rgb);
                break;
            }
        }

        echo sprintf("#%02x%02x%02x\n", ...$rgb);
    }
}
