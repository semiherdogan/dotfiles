/**
{
  "api":1,
  "name":"Text to Php Array",
  "description":"Text to php array",
  "author":"Semih",
  "icon":"quote",
  "tags":"to php array, text to php array"
}
**/

function main(state) {
  state.text = toPhpArray(state.text);

  state.postInfo('Php array initialized');
}

function toPhpArray(text) {
  let Lines = text.split('\n')

  for (let i = 0; i < Lines.length; i++) {
    Lines[i] = `'${Lines[i]}' => null`
  }

  return Lines.join(',\n')+',';
}
