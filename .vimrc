syntax enable

colorscheme desert

set backspace=indent,eol,start    "Make backspace behave like every other editor.
set number                        "Show line numbers
set tabstop=4
let mapleader = ','               "Default leader is '\', but ',' is much better




"--------------Search---------------"
set hlsearch
set incsearch




"--------------Mappings----------------"

"Make it easy to edit the Vimrc file.
nmap <Leader>ev :tabedit $MYVIMRC<cr>

"Add simple higliht removal. 
nmap <Leader><space> :nohlsearch<cr>





"--------------Auto-Commands----------------"

"Automaticly source the Vimrc file on save.

augroup autosourcing
    autocmd!
	autocmd BufWritePost .vimrc source %
augroup END


