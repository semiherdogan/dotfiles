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
        return shell_exec('cb --paste0');
    }
}

if (!function_exists('write_clipboard')) {
    function write_clipboard($data, $arrayGlue = PHP_EOL)
    {
        if (is_array($data)) {
            $data = implode($arrayGlue, $data);
        }

        exec(sprintf("echo %s | cb --copy0", escapeshellarg($data)));

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

if (!function_exists('bcrypt')) {
    function bcrypt($pass, $return = false) {
        $pass = password_hash($pass,  PASSWORD_BCRYPT);

        if ($return) {
            return $pass;
        }

        echo $pass.PHP_EOL;
    }
}

if (!function_exists('generate_password')) {
    function generate_password($length = 16, $addSpecialCharacters = true, $return = false)
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

        if ($return) {
            return $result;
        }

        echo $result.PHP_EOL;
    }
}

if (!function_exists('generate_password_with_hash')) {
    function generate_password_with_hash($length = 16, $addSpecialCharacters = true) {
        $pass = generate_password($length, $addSpecialCharacters, $return = true);

        echo $pass.PHP_EOL;
        echo bcrypt($pass, true).PHP_EOL.PHP_EOL;
    }
}

if (!function_exists('parse_date')) {
    function parse_date($date) {
        echo date('Y-m-d H:i:s', $date);
    }
}
