const Commando = require('discord.js-commando');
const path = require('path');
const sqlite = require('sqlite')
const request = require('request');
const fetch = require('node-fetch');
const fs = require('mz/fs');
const moment = require('moment');

if (!fs.existsSync('./config.json')) {
    fs.writeFileSync('./config.json', '{"token" : "", "prefix" : "!"}')
    console.log('WARNING: Config file is missing. Please edit "config.json" and re-run the script.')
    process.exit()
}

if (!fs.existsSync('./cache.json')) {
    fs.writeFileSync('./cache.json', '{ "time" : "02-19-2017 19:05:04 +0000" }')
}

const config = require('./config.json')

const client = new Commando.Client({
    owner: '91387943679172608',
    commandPrefix: config.prefix
});

client
    // Events
    .on('error', console.error)
    .on('warn', console.warn)
    //.on('debug', console.log)
    .on('ready', () => {
        console.log(`-> Client ready! \n-> Logged in as ${client.user.username}#${client.user.discriminator} (${client.user.id})`)
        console.log(`-> Servers: ${client.guilds.array().length}`)
    })
    .on('commandError', (cmd, err) => {
        if (err instanceof Commando.FriendlyError) return;
        console.error('Error in command ${cmd.groupID}:${cmd.memberName}', err)
    })

client.registry
    // Custom groups
    .registerGroups([
        ['pso2', 'Phantasy Star Online 2 commmands'],
        ['general', 'General commands'],
        ['card_games', "Card games commands"]
    ])

    // Register default groups, commands and argument types
    .registerDefaults()

    // Register every command in the ./commands/ directory
    .registerCommandsIn(path.join(__dirname, 'commands'))

client.setProvider(
    sqlite.open(path.join(__dirname, 'settings.sqlite3')).then(db => new Commando.SQLiteProvider(db))
).catch(console.error);

// EQ alerts
client.setInterval(async () => {
    try {
        const response = await fetch('http://pso2.kaze.rip/eq/');
        if (response.status !== 200) return;

        const data = await response.json();
        const cache = JSON.parse(await fs.readFile("./cache.json"));

        if (data[0]["time"] !== cache["time"]) {
            const guilds = client.guilds.filter(guild => { return client.provider.get(guild, "alerts") });
            
            for (let guild of guilds) {
                let settings = await client.provider.get(guild[1], "alerts");
                let eqs = data[0]["eqs"].filter(item => { return settings["ships"].includes(item["ship"]) });
                let format = [];
                
                if (!client.channels.get(settings['channel'])) continue;
                let channel = client.channels.get(settings['channel']);

                if (eqs.length <= 0) continue;
                if (eqs.length > 0 && eqs.length !== 10) {
                    for (let eq of eqs) {
                        format.push(`\`SHIP ${eq['ship']}:\` ${eq['name']} (${eq['jpName']})`);
                    }
                }
                else {
                    format.push(`\`ALL SHIPS:\` ${eqs[0]['name']} (${eqs[0]['jpName']})`);
                }

                let time = moment(data[0]["when"]);
                
                let string = `:watch:**IN 40 MINUTES:** (${time.format()} JST)\n${format.join('\n')}`;
                
                if (channel.type == "text" && channel.permissionsFor(client.user).has("SEND_MESSAGES") && channel.permissionsFor(client.user).has("READ_MESSAGES") && guild[1].available) {
                    try {
                        await client.channels.get(settings['channel']).send(string);
                    } catch (err) {
                        continue;
                    }
                }
            }

            await fs.writeFile("cache.json", `{ "time" : "${data[0]["time"]}" }`);
        }
    } catch (err) {
        console.error(err);
    }
}, 1000, client);

client.login(config.token);
