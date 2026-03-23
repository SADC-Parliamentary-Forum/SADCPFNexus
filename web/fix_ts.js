const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'app'));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Fix generic API occurrences
    content = content.replace(/res\.data\.data \?\? res\.data/g, '(res.data as any).data ?? res.data');
    content = content.replace(/res\.data\.data \?\? \[\]/g, '(res.data as any).data ?? []');
    content = content.replace(/r\.data\.data \?\? r\.data/g, '(r.data as any).data ?? r.data');
    content = content.replace(/r\.data\.data \?\? \[\]/g, '(r.data as any).data ?? []');

    // Any other direct assignments where typed data doesn't have data
    content = content.replace(/setProgrammes\(r\.data\.data\)/g, 'setProgrammes((r.data as any).data)');
    content = content.replace(/setRequests\(res\.data\.data\)/g, 'setRequests((res.data as any).data)');
    content = content.replace(/setBudgets\(res\.data\.data\)/g, 'setBudgets((res.data as any).data)');
    content = content.replace(/setTravelRows\(res\.data\.data\)/g, 'setTravelRows((res.data as any).data)');
    content = content.replace(/setLeaveRows\(res\.data\.data\)/g, 'setLeaveRows((res.data as any).data)');
    content = content.replace(/setBudgetRows\(res\.data\.data\)/g, 'setBudgetRows((res.data as any).data)');
    content = content.replace(/setProgRows\(res\.data\.data\)/g, 'setProgRows((res.data as any).data)');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed', file);
    }
});
