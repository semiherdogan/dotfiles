from itertools import *

def encode(l):
	return [( str(len(list(group))) + name) for name, group in groupby(l)]

def decode(l):
	return ''.join([(int(length) * item) for length,item in l])

given = 'aaaaabbbbdddbcbbbbbdddddhhhcccchhhjdjskkkkkjsjjjxxxjj'

print( given )
print( encode(given) ) 
print( decode( encode(given) ) )

"""
aaaaabbbbdddbcbbbbbdddddhhhcccchhhjdjskkkkkjsjjjxxxjj
['5a', '4b', '3d', '1b', '1c', '5b', '5d', '3h', '4c', '3h', '1j', '1d', '1j', '1s', '5k', '1j', '1s', '3j', '3x', '2j']
aaaaabbbbdddbcbbbbbdddddhhhcccchhhjdjskkkkkjsjjjxxxjj
"""

input('Quit')