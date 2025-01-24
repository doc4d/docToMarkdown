
import { HTMLToMarkdown, type HTMLToMD } from "./HTMLToMarkdown";
import * as fs from 'fs';
import path from 'path';


export function exportHTML(inFile : string, rootFolder : string, outputFolder : string) {
    let md = HTMLToMarkdown.FromFile(inFile, rootFolder)
    const outputFolderMD = path.join(outputFolder, "md")
    console.log("Exporting to ", outputFolderMD)
    fs.mkdirSync(outputFolderMD, { recursive: true })
    md.run(outputFolder).then((data) => {
        fs.writeFileSync(path.join(outputFolderMD, data.id + ".md"), data.data)
    })

}