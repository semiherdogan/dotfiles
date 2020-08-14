import requests as req
import os.path

def get_data(_url):
	r = req.get(_url, stream=True)
	if( r.status_code == 200 ):

		output_file = 'output/' + _url.split('/')[-1]

		print(  _url.split('/')[-1] )
		
		#delete old file
		if os.path.isfile(output_file):
			os.remove(output_file)
			
		#write file
		with open(output_file, 'wb') as f:
			for chunk in r.iter_content(chunk_size=1024):
				if chunk: # filter out keep-alive new chunks
					f.write(chunk)
	else:
		print( _url )
		print( r.status_code )
		print( r.text )

link_file = open('download_links.txt','r', encoding='utf-8')

links = link_file.readlines()

for i in links:
	i = i.strip()
	if(i is not ''):
		#print('.', end='', flush=True)
		get_data(i)


print()
print( 'Done !' )
input()