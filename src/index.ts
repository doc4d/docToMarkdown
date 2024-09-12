// src/index.js
import * as fs from 'fs';
import * as cheerio from "cheerio";
import { NodeHtmlMarkdown } from 'node-html-markdown'
import { Glob, glob } from 'glob'
import path from "path"

const ROOT = "4Dv20R6"
const DEST = "4Dv20R6-MD"
class Command {
    public name: string;
    public language: string;
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
    getCommandName(): string {
        return this.name.toLowerCase().replace(/\s+/g, "-")
    }

}

let notValidLink: Set<string> = new Set<string>()
let commandsDone: Set<string> = new Set<string>()



class HTMLCommandToMarkdown {
    private $: cheerio.Root;
    public _command: Command;
    private _rootFolder: string;
    private constructor(inFile: string, inFileData: Buffer, inRootFolder: string) {
        this.$ = cheerio.load(inFileData);
        this._command = new Command(inFile)
        this._rootFolder = inRootFolder;
    }

    static FromFile(inFile: string, inRootFolder: string): HTMLCommandToMarkdown {
        return new HTMLCommandToMarkdown(inFile, fs.readFileSync(inFile), inRootFolder)
    }

    static FromFileData(inFile: string, inFileData: Buffer, inRootFolder: string): HTMLCommandToMarkdown {
        return new HTMLCommandToMarkdown(inFile, inFileData, inRootFolder)
    }

    static isLinkACommand(file: Buffer): boolean {
        let s = file.toString()
        return (s.includes("100-6957482") /*language*/
        || s.includes("100-6993921")/*write pro*/) && s.includes("ak_700.png")
    }

    static isDeprecated(file: string): boolean {
        return path.parse(file).name.startsWith("o-")
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

        return markdownTable;
    }

    _convertParamsArray(): string {
        let $args = this.$(".tSynt_table");
        let syntax = $args.find(".tSynt_td_cc").text().trim();
        syntax = syntax.replace(/^(.*)(?=\s\()/, "**$1**")
        syntax = syntax.replace(/([a-zA-Z]+)(?= ;|\s\))/g, "*$1*")

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
        syntax = `<!--REF #_command_.${this._command.name}.Syntax-->` + syntax + "<!-- END REF-->"
        const array = `<!--REF #_command_.${this._command.name}.Params-->\n` + this._jsonToMarkdownTable(formatedArgs) + "\n<!-- END REF-->"
        return syntax + "\n" + array + "\n"
    }

    _convertDescription(): string {
        let $args = this.$(".command_paragraph");
        if ($args.length == 0) {
            $args = this.$("body")
        }
        let firstDescription = $args.find(".rte4d").first();
        if (firstDescription.length > 0) {
            firstDescription.prepend("__DESC__")
        }
        else {
            console.error("No Description found")
        }

        $args.find(".rte4d_prm").each((i, el) => {
            this.$(el).replaceWith("<i>" + this.$(el).html() + "</i>")
        })
        $args.find("code").each((i, e) => {
            let currentLanguage = this.$(e).parent().attr("class");
            currentLanguage = currentLanguage?.split("code")[1]
            this.$(e).replaceWith(`<pre><code class="language-${currentLanguage}">` + this.$(e).html() as string + "</pre></code>")
        })
        $args.find("tr").find("br").each((i, el) => {
            this.$(el).replaceWith("__SPACE__")
        })


        let markdown = NodeHtmlMarkdown.translate($args.html() as string, { emDelimiter: "*" })
        markdown = markdown.replace(/\\_\\_SPACE\\_\\_/g, "<br/>")
        markdown = markdown.replace(/\\_\\_SPACE\\_\\_/g, "<br/>")
        markdown = markdown.replace(/\\_\\_DESC\\_\\_\s+(.*[\.。])/, `<!--REF #_command_.${this._command.name}.Syntax-->$1<!-- END REF-->`)
        markdown = markdown.replace(/\\_\\_DESC\\_\\_/, "")

        return markdown
    }



    _createHeader() {
        return "---\n" +
            "id: " + this._command.getCommandName() + "\n" +
            "title: " + this._command.name + "\n" +
            "---\n"
    }

    _convertPictures() {
        let $args = this.$(".command_paragraph");
        $args.find("img").each((i, el) => {
            let imagePath = this.$(el).attr("src");
            if (imagePath && this._command.language) {
                let parsedImagePath = path.parse(imagePath)
                let name = parsedImagePath.name + parsedImagePath.ext
                this.$(el).attr("src", "../assets/en/Commands/" + name)
                const dest = path.join(DEST, this._command.language, "assets", "en", "Commands");
                if (!fs.existsSync(dest))
                    fs.mkdirSync(dest, { recursive: true })
                try {
                    fs.copyFileSync(path.join(this._rootFolder, imagePath), path.join(dest, name))
                } catch (e) {
                    console.error("Image not found:", imagePath)
                }
            }
        })
    }

    _convertLinks() {
        this.$("a").each((i, el) => {
            let link = this.$(el).attr("href");
            if (link && link.endsWith(".html")) {
                try {
                    let commandLocation;
                    if (link.startsWith("/")) {
                        commandLocation = "." + link
                    }
                    else {
                        commandLocation = path.join(this._rootFolder, link)
                    }
                    if (notValidLink.has(link)) {
                        console.error("Cannot convert link:", link)
                        return;
                    }
                    let data = fs.readFileSync(commandLocation)
                    if (HTMLCommandToMarkdown.isLinkACommand(data) && !HTMLCommandToMarkdown.isDeprecated(commandLocation)) {
                        const dest = new Command(link).getCommandName() + ".md";
                        this.$(el).attr("href", dest);
                    }
                    else {
                        notValidLink.add(link);
                        console.error("Cannot convert link, not a command:", link)
                    }
                } catch (e) {
                    notValidLink.add(link);
                    console.error("Cannot convert link:", link)
                }

            }
        })
    }

    _convertSeeAlso(): string {
        let $args = this.$("#SeeAlso_title");
        let markdown = "";
        if ($args.length > 0) {
            markdown = "\n####" + NodeHtmlMarkdown.translate($args.html() as string) + "\n"
            markdown += NodeHtmlMarkdown.translate($args.next().html() as string)
        }

        return markdown;
    }

    run() {
        console.log(this._command)
        let list = []
        this._convertLinks();
        this._convertPictures();
        list.push(this._createHeader())
        list.push(this._convertParamsArray());
        list.push(this._convertDescription());
        list.push(this._convertSeeAlso());

        return list.join("\n");
    }
}



async function getListOfCommands() {
    const commandRoot = ROOT + "/4D/20-R6/";
    if (!fs.existsSync(DEST))
        fs.mkdirSync(DEST);


    let g = new Glob([commandRoot + "*.902-*"], {});
    for (const value of g) {
        let $ = cheerio.load(fs.readFileSync(value));
        console.log(value)
        $("#Title_list").find("a").each((i, el) => {

            if ($(el).text().length == 1)
                return;
            const commandPath = commandRoot + $(el).attr("href")
            const command = new Command(commandPath)
            const newName = command.getCommandName() + ".md";
            console.log(newName)
            if (commandsDone.has(command.language + "/" + newName))
                return;
            let data = fs.readFileSync(commandPath)
            if (data && HTMLCommandToMarkdown.isLinkACommand(data) && !HTMLCommandToMarkdown.isDeprecated(commandPath)) {
                const c = HTMLCommandToMarkdown.FromFileData(commandPath, data, commandRoot)
                commandsDone.add(command.language + "/" + newName)
                if (newName && command.language) {
                    const dest = path.join(DEST, command.language, "Commands");
                    if (!fs.existsSync(dest))
                        fs.mkdirSync(dest, { recursive: true })
                    fs.writeFileSync(path.join(dest, newName), c.run())
                }
            }
        })
    }
}
getListOfCommands()
console.log(">>>>>>");
//let c = HTMLCommandToMarkdown.FromFile("4Dv20R6\\4D\\20-R6\\Abs.301-6958535.fr.html", ROOT + "/4D/20-R6/")
//console.log(HTMLCommandToMarkdown.isLinkACommand(fs.readFileSync("4Dv20R6\\4D\\20-R6\\Abs.301-6958535.fr.html")))
//let c = new HTMLCommandToMarkdown("resources/OBJET-FIXER-LISTE-PAR-REFERENCE.301-6958775.fr.html", "")
//fs.writeFileSync("test.md", c.run())
console.log("<<<<<<");



