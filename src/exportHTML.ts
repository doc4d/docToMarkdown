
import { HTMLToMarkdown, type HTMLToMD } from "./HTMLToMarkdown";
import * as fs from 'fs';
import path from 'path';
import { Glob } from "glob";

export function exportHTML(inFile: string, rootFolder: string, outputFolder: string) {
    let g = new Glob([inFile], {});

    for (const file of g) {
        let md = HTMLToMarkdown.FromFile(file, rootFolder)
        const outputFolderMain = path.join(outputFolder, path.parse(file).base)
        const outputFolderMD = path.join(outputFolderMain, "md")
        console.log("Exporting to ", outputFolderMD)
        fs.mkdirSync(outputFolderMD, { recursive: true })
        md.run(outputFolderMain).then((data) => {
            fs.writeFileSync(path.join(outputFolderMD, data.id + ".md"), data.data)
        })
    }

}