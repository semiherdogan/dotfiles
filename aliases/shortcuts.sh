# Laravel Local documentation
# https://github.com/laratoolbox/laravel-local-documentation
laravel-doc-update() {
    LD_BASE_DIRECTORY="~/Code/laravel-documentation"
    php $LD_BASE_DIRECTORY/update.php
    cd $LD_BASE_DIRECTORY/docs
}

ld() {
    LD_BASE_DIRECTORY="~/Code/laravel-documentation"
    if nc -z 127.0.0.1 8888; then
        open http://localhost:8888
    else
        cd $LD_BASE_DIRECTORY && 
        open http://localhost:8888 && 
        nohup php -S 127.0.0.1:8888 &
    fi
}
## 

# Red Langugae
update-red() {
    if grep -q 'passing' <<<"$(curl -s https://bs.red-lang.org/macos.svg)"; then
        cd "/Users/semiherdogan/Programs/" &&
        curl -o "red" https://static.red-lang.org/dl/auto/mac/red-latest &&
        chmod +x red &&
        red &&
        echo 'Red updated.'
    else
        echo 'not passing'
    fi
}