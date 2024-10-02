// src/index.js
import * as fs from 'fs';
import * as cheerio from "cheerio";
import { Glob } from 'glob'
import path from "path"
import { HTMLCommandToMarkdown } from "./HTMLCommandToMarkdown";
import { Command } from './command';


async function getListOfCommands(inRootFolder: string, inDestFolder: string) {
    const commandRoot = inRootFolder;
    if (!fs.existsSync(inDestFolder))
        fs.mkdirSync(inDestFolder);

    let commandsDone: Set<string> = new Set<string>()
    let listCommands: any[] = []
    let listCommandsByTheme: Map<string, string[]> = new Map<string, string[]>()
    let g = new Glob([commandRoot + "*.301-*"], {});
    for (const value of g) {

        const commandPath = value
        const command = new Command(commandPath)
        const newName = command.getCommandID() + ".md";
        console.log(newName)
        if (command.language === 'fr' || commandsDone.has(command.language + "/" + newName))
            continue;
        if (HTMLCommandToMarkdown.isLinkACommand(commandPath)) {
            let data = fs.readFileSync(commandPath)
            if (data && HTMLCommandToMarkdown.isLinkACommandFromLanguage(data, commandPath) && !HTMLCommandToMarkdown.isDeprecated(commandPath)) {
                const c = HTMLCommandToMarkdown.FromFileData(commandPath, data, commandRoot)
                if (command.language == "en") {
                    const theme = command.language + "/" + c.getTheme()
                    let list = listCommandsByTheme.get(theme)
                    if (!list) {
                        list = []
                    }
                    list.push(c.commandType + "/" + command.getCommandID())
                    listCommandsByTheme.set(theme, list)
                }

                commandsDone.add(command.language + "/" + newName)
                if (newName && command.language) {
                    const dest = path.join(inDestFolder, command.language, c.commandType);
                    if (!fs.existsSync(dest)) {
                        fs.mkdirSync(dest, { recursive: true })
                    }
                    const d = await c.run(inDestFolder)
                    fs.writeFileSync(path.join(dest, newName), d)
                    if (command.language == "en") {
                        listCommands.push({ name: command.getCommandName(), dest: "../" + c.commandType + "/" + newName });
                    }
                }
            }
        }

    }

    convertThemesToJSON(listCommandsByTheme)
    createIndex(listCommands)
}

function createIndex(listCommands: any[]) {

    listCommands.sort((a, b) => {
        return a.name.localeCompare(b.name)
    })
    let data = "---\n" +
        "id: command-index\n" +
        "title: Index\n" +
        "---\n\n"
    let currentLetter = ""
    let previousLetter = ""
    //[4D](#4D)
    for (let command of listCommands) {
        currentLetter = command.name[0].toUpperCase()
        let letters = currentLetter == '4' ? currentLetter + 'D' : currentLetter;
        if (currentLetter != previousLetter) {
            data += `[${letters}](#${letters}) - `
        }
        previousLetter = currentLetter
    }
    data = data.slice(0, -3)
    data += "\n\n"
    currentLetter = ""
    previousLetter = ""

    for (let command of listCommands) {
        currentLetter = command.name[0].toUpperCase()
        let letters = currentLetter == '4' ? currentLetter + 'D' : currentLetter;
        if (currentLetter != previousLetter) {
            data += `\n<a id="${letters}"><b>${letters}</b></a>\n\n`
        }
        data += `[\`${command.name}\`](${command.dest})<br/>\n`
        previousLetter = currentLetter
    }

    fs.writeFileSync("command-index.md", data)
}

function convertThemesToJSON(listCommandsByTheme: Map<string, string[]>) {
    let themes: any = []
    let sorted = new Map([...listCommandsByTheme.entries()].sort())
    sorted.forEach((value, key) => {
        let theme = key.split("/")
        let themeName = theme[1]
        value.sort()
        themes.push({ type: "category", label: themeName, items: value })
    })
    fs.writeFileSync("themes.json", JSON.stringify(themes, null, 2))
}

async function test(path: string) {
    let c = HTMLCommandToMarkdown.FromFile(path, htmlFolder)
    console.log("Is a command", HTMLCommandToMarkdown.isLinkACommandFromLanguage(fs.readFileSync(path), path))
    fs.writeFileSync("test.md", await c.run(mdFolder))
}

var argv = require('minimist')(process.argv.slice(2));
let htmlFolder = argv.html;
if (!htmlFolder) {
    htmlFolder = "4Dv20R6/4D/20-R6/"
}
let mdFolder = argv.md;
if (!mdFolder) {
    mdFolder = "4Dv20R6-MD"
}


fs.rmSync(mdFolder, { recursive: true, force: true })
fs.rmSync("combined.log", { force: true })
fs.rmSync("error.log", { force: true })

getListOfCommands(htmlFolder, mdFolder).then(() => {
    //    console.log("Done")
})
//test("4Dv20R6\\4D\\20-R6\\WP-EXPORT-DOCUMENT.301-6993969.ja.html")




