const fs = require('fs/promises');
const puppeteer = require('puppeteer');
const YAML = require('json2yaml');

const config = {
    output_dir: './state_files',
    targetURL: 'https://childcare.gov/state-resources?state=',
    puppeteer: {
        headless: false
    },
    stateSections: [
        '201',
        // '202',
        // '203',
        // '204'
    ]
};

// 201 = "Understanding and Finding Child Care"
// 202 = "Financial Assistance For Families"
// 203 = "Health & Social Services"
// 204 = "Child Development & Early Living"

const stateData = new Map([
    [6, "Alabama"],
    // [7, "Alaska"],
    // [8, "Arizona"],
    // [9, "Arkansas"],
    // [10, "California"],
    // [11, "Colorado"],
    // [12, "Connecticut"],
    // [13, "Delaware"],
    // [14, "Florida"],
    // [15, "Georgia"],
]);

const sectionMap = {
    201: "Understanding and Finding Child Care",
    202: "Financial Assistance For Families",
    203: "Health & Social Services",
    204: "Child Development & Early Living"
};

(async () => {
    const browser = await puppeteer.launch(config.puppeteer);
    const page = await browser.newPage();

    for (const [stateID, stateName] of stateData) {
        for (const sectionID of config.stateSections) {
            await page.goto(`${config.targetURL}${stateID}&type=${sectionID}`, {waitUntil: 'networkidle2'});
            const linkSections = await page.evaluate((sel) => {
                let els = Array.from(document.querySelectorAll(sel));
                let sectionData = els.map(el => {
                    // First child of each link section is the section title
                    const data = {title: el.children[0].innerText, links:[]};
                    const links = Array.from(el.querySelectorAll('.list-links > ul > li > a:not(.exit_link)'));
                    links.map(li => {
                        return data.links.push({text: li.innerText, href: li.href});
                    });
                    return data;
                });
                return sectionData;
            }, '.col-sm-6:not(.col-lg-4)');

            let templateFile = await fs.readFile('template.md', {encoding: "utf8"});
            templateFile = templateFile.replace('$permalink$', `state-resources/${stateName.toLowerCase()}-${sectionID}`);
            templateFile = templateFile.replace('$statename$', stateName);
            templateFile = templateFile.replace('$sectionname$',  sectionMap[sectionID]);

            const yamalizedData = YAML.stringify(linkSections).replace('---', '').replace('\n','');
            templateFile = templateFile.replace('$links$', yamalizedData);

            await fs.writeFile(`${config.output_dir}/${stateName}-${sectionID}.md`, templateFile);
        }
    }
    browser.close();
})();