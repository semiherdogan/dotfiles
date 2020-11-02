git--conflicts-resolve () {
    echo "${COLOR_RED}For test -> release${NO_COLOR}"
    echo 'git checkout release'
    echo 'git merge --no-ff -m "Merged in test (pull request #47)" remotes/origin/test'
}

laravel-listen-queries() {
    cat << EOF
\DB::listen(function ($query) {
    \$sql = \$query->sql;

    foreach (\$query->bindings as \$binding) {
        \$value = is_numeric($binding) ? \$binding : "'".\$binding."'";
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

github-config() {
    git config user.name "Semih ERDOGAN"
    git config user.email "hasansemiherdogan@gmail.com"
}
