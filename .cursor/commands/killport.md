Kill the port by running the following command. 

Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force } 

Dont give any long response, just tell me ion one word if killed or not. 
If not tell me reason in one line.