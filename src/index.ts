// src/index.js
import * as fs from 'fs';
import { exportHTML } from "./exportHTML";
import path from 'path';

var argv = require('minimist')(process.argv.slice(2));
console.log("argv", argv)

try
{
    fs.rmSync(argv.out, { recursive: true, force: true })
    fs.rmSync(path.join(argv.out, "combined.log"), { force: true })
    fs.rmSync(path.join(argv.out, "combined.log"))
}catch(e)
{

}

const root = path.parse(argv.html).dir
console.log("root", root)
exportHTML(argv.html, root, argv.out)

