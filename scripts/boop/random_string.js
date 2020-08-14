/**
{
  "api":1,
  "name":"Random String",
  "description":"Generates random string",
  "author":"Semih",
  "icon":"quote",
  "tags":"random, string"
}
**/

function main(state) {
  state.fullText = state.fullText + '\n' + randomString(10);

  state.postInfo('Random string generated');
}

function randomString(length) {
  let   result           = '';
  const characters       = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}
