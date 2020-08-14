import re
import os.path
import subprocess

def getClipboardData():
	return subprocess.check_output('pbpaste', env={'LANG': 'en_US.UTF-8'}).decode('utf-8')

def setClipboardData(data):
    process = subprocess.Popen('pbcopy', env={'LANG': 'en_US.UTF-8'}, stdin=subprocess.PIPE)
    process.communicate(data.encode('utf-8'))

logs = getClipboardData().splitlines()

headers = ''
allData = ''
row=''

_start=False
_get_headers=True
for i in logs:
	i = i.strip()
	
	if i is '(':
		_start=True
		continue
	elif i is ')':
		if _get_headers is True:
			allData += headers[:-1] + '\n'
			_get_headers=False
			
		allData += row[:-1] + '\n'
		row=''
		_start=False
		continue
	else:
		if _start is True:
			find = re.search('(^\[(.+?)\] => (.+))', i)
			if find is not None:
				if _get_headers is True:
					headers += find.group(2) + '\t'
			
				row += find.group(3)

			row += '\t'

setClipboardData(allData[:-1])

print('Copied to clipboard!')
