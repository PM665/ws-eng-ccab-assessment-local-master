local key = KEYS[1]
local charge = ARGV[1]
local balance = redis.call('get', key) or 0
balance = balance - charge
if (balance >= 0) then
    redis.call('set', key, balance)
    return balance
else
    return ""
end