git--conflicts-resolve () {
    cat << EOF
For test -> release
git checkout release
git merge --no-ff -m "Merged in test (pull request #XXX)" remotes/origin/test
EOF
}

laravel-listen-queries() {
    cat << EOF
\DB::listen(function (\$query) {
    \$sql = \$query->sql;

    foreach (\$query->bindings as \$binding) {
        \$value = is_numeric(\$binding) ? \$binding : "'".\$binding."'";
        \$sql = preg_replace('/\?/', \$value, \$sql, 1);
    }

    logger()->error(\$sql);

    /*
    logger()->error([
        \$query->time,
        \$query->sql,
        \$query->bindings
    ]);
    */
});
EOF
}
