AutoPatchWork for JetPack
==========

This is the fork of AutoPatchWork ( http://code.google.com/p/autopatchwork/ ).
It needs Add-on SDK if you build this project.

Code Base
-------

This source code is based on AutoPatchWork for Google Chrome Extension.
( https://chrome.google.com/webstore/detail/aeolcjbaammbkgaiagooljfdepnjmkfd )

License
-------

This source code is licensed under a Original Code License.

Important Note
-------

This source code has a security risk currently.

*I do not reccomend to use this.*
**(This risk has fixed on original version.)**

### Risk Abstract

In a particular situation, this insert the different domain page in the current page.
This risk is reported by xKhorasan.

### Situation

If the page which you meets the following conditions:

1. The page's next-link is an open redirector and is same domain as the page.
2. The redirected page provides "Access-Control-Allow-Origin" header.

### Result

If you meet the above conditions,
This insert the different domain page in the current page.

### Workaround

Sorry, none.

I thought following approach, but I didn't employ them.

1st, I approached to fix this bug throgh 
using the approach of Original version (Google Chrome).
But Firefox can not employ this approach.
Firefox's XMLHttpRequest can get the reported page 
when it opens redirector.
(Google Chrome cannnot get the redirected page.)


The 2nd approach is to use XMLHttpRequest.channel,
which is Firefox's uniquely feature.
But this property needs elevated privileges to access.
So it can not employ this approach, by AutoPatchWork's design.
(However, AutoPagerize for Firefox uses this approach.
AutoPagerize gets the sequel of page from elevated privileges namespace
by design.)



