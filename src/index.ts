// src/index.js
import * as fs from 'fs';
import * as cheerio from "cheerio";
import { NodeHtmlMarkdown } from 'node-html-markdown'
import { Glob } from 'glob'
import path from "path"
import winston from 'winston';



const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.json()),
    transports: [
        //
        // - Write all logs with importance level of `error` or less to `error.log`
        // - Write all logs with importance level of `info` or less to `combined.log`
        //
        new winston.transports.Console({ format: winston.format.colorize({ all: true }) }),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});
//logger.silent = true;
let notValidLink: Set<string> = new Set<string>()

//const ROOT = "4Dv20R6"
//const DEST = "4Dv20R6-MD"
class Command {
    public language: string;
    private name: string;

    constructor(link: string) {
        let fileName = path.parse(link).name;
        this.name = fileName
        this.language = "en"

        let splits = fileName.split(".");
        if (splits.length > 2) {
            this.name = splits[0].replace(/-/g, " ");
            this.language = splits[2];
        }
    }
    getCommandID(): string {
        const id = this.name.toLowerCase().replace(/\s+/g, "-")
        return id;
    }

    getCommandID_Header(): string {
        const id = this.getCommandID()

        if ((id === "false" || id === "true" || id === "null"))
            return `"${id}"`;
        return id;
    }

    isC_Command(): boolean {
        return this.name.startsWith("C ")
    }
    getCommandName(): string {
        if (this.isC_Command()) {
            return this.name.replace(/\s+/g, "_")
        }
        return this.name
    }

    getCommandName_Header(): string {
        const name = this.getCommandName()

        if ((name === "False" || name === "True" || name === "Null"))
            return `"${name}"`;
        return name;
    }

    toString(): string {
        return `{name:${this.name}, language:${this.language}}`
    }

}



class HTMLCommandToMarkdown {
    private $: cheerio.Root;
    public _command: Command;
    private _rootFolder: string;
    public commandType: string = "Command";
    private constructor(inFile: string, inFileData: Buffer, inRootFolder: string) {
        this.$ = cheerio.load(inFileData);
        this._command = new Command(inFile)
        this._rootFolder = inRootFolder;
        this.commandType = inFileData.includes("100-6993921") && this._command.getCommandID().startsWith("wp") ? "WP" : "commands";
    }

    static FromFile(inFile: string, inRootFolder: string): HTMLCommandToMarkdown {
        return new HTMLCommandToMarkdown(inFile, fs.readFileSync(inFile), inRootFolder)
    }

    static FromFileData(inFile: string, inFileData: Buffer, inRootFolder: string): HTMLCommandToMarkdown {
        return new HTMLCommandToMarkdown(inFile, inFileData, inRootFolder)
    }

    static isLinkACommand(file: Buffer, inFile: string): boolean {
        if (inFile.includes("301-")) {
            let s = file.toString()
            return (s.includes("100-6957482") /*language*/
                || s.includes("100-6993921")/*write pro*/) && s.includes("ak_700.png") && !s.includes("ak_610.png")
        }
        return false;
    }

    static isDeprecated(file: string): boolean {
        return path.parse(file).name.startsWith("o-")
    }

    getTheme(): string {
        return this.$(".ppB").last().text().trim()
    }

    _jsonToMarkdownTable(data: any[][]): string {
        let markdownTable = '';

        // Extract headers
        const headers = data[0];
        markdownTable += '| ' + headers.join(' | ') + ' |\n';
        markdownTable += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

        // Extract rows
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            markdownTable += '| ' + row.join(' | ') + ' |\n';
        }
        markdownTable = markdownTable.replace(/->/g, "&rarr;")
        markdownTable = markdownTable.replace(/<->/g, "&harr;")
        markdownTable = markdownTable.replace(/<-/g, "&larr;")

        return markdownTable;
    }

    _convertParamsArray(): string {
        let $args = this.$(".tSynt_table");
        let syntax = $args.find(".tSynt_td_cc").text().trim();
        syntax = syntax.replace(/^([\p{L}\s\d_]+)(?=\b\s*\(|\b\s*-|$|\b\s*\{)/u, "**$1**")
        syntax = syntax.replace(/(?<=;\s*\b|\(\s*\b|\)\s*\b|\{\s*\b|\}\s*\b)([\p{L}\d]+)(?=\s*;|\s*\)|\s*\{|\s*\})/gu, "*$1*")

        let tr = $args.find("tr");

        let formatedArgs = [];
        for (let i = 3; i < tr.length; i++) {
            let valid = false;
            let a: string[] = [];
            this.$(tr.get(i)).children().each((index, element) => {
                let e = this.$(element)
                let text = e.text().trim()
                if (text.length == 0) {
                    let image = e.find("img").attr("src");
                    if (image) {
                        valid = true;
                        if (image.endsWith("in_out1.png")) {
                            a.push("->");
                        }
                        else if (image.endsWith("in_out0.png")) {
                            a.push("<-");
                        }
                        else if (image.endsWith("in_out2.png")) {
                            a.push("<->");
                        }
                    }
                    return;
                }
                valid = true;
                a.push(text);
            });
            if (valid)
                formatedArgs.push(a);
        }
        if (formatedArgs.length == 0)
            return ""
        formatedArgs[0].splice(2, 0, "");
        syntax = `<!--REF #_command_.${this._command.getCommandName()}.Syntax-->` + syntax + "<!-- END REF-->"
        const array = `<!--REF #_command_.${this._command.getCommandName()}.Params-->\n` + this._jsonToMarkdownTable(formatedArgs) + "\n<!-- END REF-->"
        return syntax + "\n" + array + "\n"
    }

    _convertDescription(inDestFolder: string): string {
        let $args = this.$(".command_paragraph");
        if ($args.length == 0) {
            $args = this.$("body")
        }
        this._convertLinks($args)
        this._convertPictures(inDestFolder, $args)
        let firstDescription = $args.find(".rte4d").first();
        if (firstDescription.length > 0) {
            firstDescription.prepend("__DESC__")
        }
        else {
            logger.error({ file: this._command, message: "No Description found" })
        }

        $args.find(".rte4d_prm").each((i, el) => {
            this.$(el).replaceWith("<i>" + this.$(el).html() + "</i>")
        })
        $args.find("pre").each((i, e) => {
            let currentLanguage = this.$(e).parent().attr("class");
            currentLanguage = currentLanguage?.split("code")[1]
            let content = this.$(e).html();
            this.$(e).parent().replaceWith(`<pre><code class="language-${currentLanguage}">` + content as string + "</pre></code>")
        })
        $args.find("code").each((i, e) => {
            let currentLanguage = this.$(e).parent().attr("class");
            if (!currentLanguage || currentLanguage?.startsWith("language-"))
                return;
            currentLanguage = currentLanguage?.split("code")[1]
            let content = this.$(e).text();
            this.$(e).replaceWith(`<pre><code class="language-${currentLanguage}">` + content as string + "</pre></code>")
        })
        $args.find("tr").find("br").each((i, el) => {
            this.$(el).replaceWith("__SPACE__")
        })
        let markdown = NodeHtmlMarkdown.translate($args.html() as string, { emDelimiter: "*" })
        markdown = markdown.replace(/\\_\\_SPACE\\_\\_/g, "<br/>")
        markdown = markdown.replace(/\\_\\_SPACE\\_\\_/g, "<br/>")
        markdown = markdown.replace(/\\_\\_DESC\\_\\_\s+(.*?[\.。])(?!md)/, `<!--REF #_command_.${this._command.getCommandName()}.Summary-->$1<!-- END REF-->`)
        markdown = markdown.replace(/\\_\\_DESC\\_\\_/, "")
        markdown = this._convertOld4DCode(markdown)

        return markdown
    }

    _convertC_Command(code4D: string): string {
        if (this._command.isC_Command())
            return code4D;
        let regexConvertOldCommands = /(C_\w*)\((.*)\)/g;
        let newContent
        while ((newContent = regexConvertOldCommands.exec(code4D)) !== null) {
            let newType = ""
            if (newContent[1] == "C_OBJECT") {
                newType = "Object"
            }
            else if (newContent[1] == "C_LONGINT") {
                newType = "Integer"
            }
            else if (newContent[1] == "C_REAL") {
                newType = "Real"
            }
            else if (newContent[1] == "C_VARIANT") {
                newType = "Variant"
            }
            else if (newContent[1] == "C_TEXT") {
                newType = "Text"
            }
            else if (newContent[1] == "C_BOOLEAN") {
                newType = "Boolean"
            }
            else if (newContent[1] == "C_POINTER") {
                newType = "Pointer"
            }
            else if (newContent[1] == "C_PICTURE") {
                newType = "Picture"
            }
            else if (newContent[1] == "C_BLOB") {
                newType = "Blob"
            }
            else if (newContent[1] == "C_DATE") {
                newType = "Date"
            }
            else if (newContent[1] == "C_TIME") {
                newType = "Time"
            }
            else if (newContent[1] == "C_COLLECTION") {
                newType = "Collection"
            }
            else if (newContent[1] == "C_STRING") {
                logger.error({ message: `Cannot convert old 4D Code: ${newContent[1]}`, file: this._command })
            }
            else {
                logger.error({ message: `Cannot convert old 4D Code: ${newContent[1]}`, file: this._command })
            }
            if (newType != "")
                code4D = code4D.replace(newContent[0], `var ${newContent[2]} : ${newType}`)
        }
        return code4D;
    }

    _convertOldComments(code4D: string): string {
        let regexConvertOldComments = /`(.+)/gu
        let newContent
        while ((newContent = regexConvertOldComments.exec(code4D)) !== null) {
            code4D = code4D.replace(newContent[0], `//${newContent[1]}`)
        }
        return code4D;
    }

    _convertOld4DCode(markdown: string): string {
        let regexCode4D = /(?<=```4d\s)(\s+[\s\S]*?)(?=\s```)/gmu
        let result: RegExpExecArray | null;
        while ((result = regexCode4D.exec(markdown)) !== null) {
            const before = markdown.substring(0, result.index)
            const after = markdown.substring(result.index + result[0].length)
            let code4D = result[0]
            code4D = this._convertC_Command(code4D)
            code4D = this._convertOldComments(code4D)
            markdown = before + code4D + after
        }
        return markdown;
    }


    _createHeader() {
        return "---\n" +
            "id: " + this._command.getCommandID_Header() + "\n" +
            "title: " + this._command.getCommandName_Header() + "\n" +
            "displayed_sidebar: docs\n" +
            "---\n"
    }

    _convertPictures(inDestFolder: string, $args: cheerio.Cheerio) {

        $args.find("img").each((i, el) => {
            let imagePath = this.$(el).attr("src");
            if (imagePath && this._command.language) {
                let parsedImagePath = path.parse(imagePath)
                let name = parsedImagePath.name + parsedImagePath.ext
                this.$(el).attr("src", "../assets/en/" + this.commandType + "/" + name)
                const dest = path.join(inDestFolder, this._command.language, "assets", "en", this.commandType);
                if (!fs.existsSync(dest))
                    fs.mkdirSync(dest, { recursive: true })
                try {
                    fs.copyFileSync(path.join(this._rootFolder, imagePath), path.join(dest, name))
                } catch (e) {
                    logger.error({ file: this._command, message: `Image not found: ${imagePath}` })
                }
            }
        })
    }

    _convertLinks($args: cheerio.Cheerio) {
        $args.find("a").each((i, el) => {
            let link = this.$(el).attr("href");
            const aClass = this.$(el).attr("class");
            const is4DCode = aClass?.startsWith("code4d")
            if (link && link.endsWith(".html") && !is4DCode) {
                try {
                    let commandLocation;
                    if (link.startsWith("/")) {
                        commandLocation = "." + link
                    }
                    else {
                        commandLocation = path.join(this._rootFolder, link)
                    }
                    if (notValidLink.has(link)) {
                        logger.error({ message: `Cannot convert link: ${link}`, file: this._command })
                        return;
                    }
                    const data = fs.readFileSync(commandLocation)
                    if (HTMLCommandToMarkdown.isLinkACommand(data, commandLocation) && !HTMLCommandToMarkdown.isDeprecated(commandLocation)) {
                        const dest = new Command(link).getCommandID() + ".md";
                        this.$(el).attr("href", dest);
                    }
                    else {
                        notValidLink.add(link);
                        this.$(el).replaceWith(`<em>${this.$(el).text()}</em>`);
                        logger.error({ message: `Cannot convert link: ${link}`, file: this._command })
                    }
                } catch (e) {
                    notValidLink.add(link);
                    this.$(el).replaceWith(`<em>${this.$(el).text()}</em>`);
                    logger.error({ message: `Cannot convert link: ${link}`, file: this._command })
                }

            }
        })
    }

    _convertSeeAlso(): string {
        let $args = this.$("#SeeAlso_title");
        this._convertLinks($args.next())
        let markdown = "";
        if ($args.length > 0) {
            markdown = "\n####" + NodeHtmlMarkdown.translate($args.html() as string) + "\n\n"
            markdown += NodeHtmlMarkdown.translate($args.next().html() as string)
        }

        return markdown;
    }

    run(inDestFolder: string) {
        logger.info({ file: this._command })
        let list = []
        list.push(this._createHeader())
        list.push(this._convertParamsArray());
        list.push(this._convertDescription(inDestFolder));
        list.push(this._convertSeeAlso());

        return list.join("\n");
    }
}



async function getListOfCommands(inRootFolder: string, inDestFolder: string) {
    const commandRoot = inRootFolder;
    if (!fs.existsSync(inDestFolder))
        fs.mkdirSync(inDestFolder);


    let commandsDone: Set<string> = new Set<string>()
    let listCommandsByTheme: Map<string, string[]> = new Map<string, string[]>()
    let g = new Glob([commandRoot + "*.902-*"], {});
    for (const value of g) {
        let $ = cheerio.load(fs.readFileSync(value));
        $("#Title_list").find("a").each((i, el) => {

            if ($(el).text().length == 1)
                return;
            const commandPath = commandRoot + $(el).attr("href")
            const command = new Command(commandPath)
            const newName = command.getCommandID() + ".md";
            if (command.language == 'fr' || commandsDone.has(command.language + "/" + newName))
                return;
            let data = fs.readFileSync(commandPath)
            if (data && HTMLCommandToMarkdown.isLinkACommand(data, commandPath) && !HTMLCommandToMarkdown.isDeprecated(commandPath)) {
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
                    if (!fs.existsSync(dest))
                        fs.mkdirSync(dest, { recursive: true })
                    fs.writeFileSync(path.join(dest, newName), c.run(inDestFolder))
                }
            }
        })
    }
    convertThemesToJSON(listCommandsByTheme)
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

var argv = require('minimist')(process.argv.slice(2));
let htmlFolder = argv.html;
if (!htmlFolder) {
    htmlFolder = "4Dv20R6/4D/20-R6/"
}
let mdFolder = argv.md;
if (!mdFolder) {
    mdFolder = "4Dv20R6-MD"
}


//fs.rmSync(mdFolder, { recursive: true, force: true })
fs.rmSync("combined.log", { force: true })
fs.rmSync("error.log", { force: true })

getListOfCommands(htmlFolder, mdFolder)
//let c = HTMLCommandToMarkdown.FromFile("4Dv20R6\\4D\\20-R6\\ARRAY-TO-LIST.301-6958332.en.html", htmlFolder)
//let c = new HTMLCommandToMarkdown("resources/OBJET-FIXER-LISTE-PAR-REFERENCE.301-6958775.fr.html", "")
//fs.writeFileSync("test.md", c.run(mdFolder))

console.log("Done")

