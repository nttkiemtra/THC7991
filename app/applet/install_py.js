const { execSync } = require('child_process');

try {
    console.log('Installing python-docx...');
    execSync('python3 -m pip install python-docx --break-system-packages', { stdio: 'inherit' });
    console.log('Success!');
} catch (e) {
    if (e.message.includes('--break-system-packages')) {
        try {
            console.log('Retrying without break-system-packages...');
            execSync('python3 -m pip install python-docx', { stdio: 'inherit' });
        } catch (err) {
            console.error('Failed', err);
        }
    } else {
       console.error('Failed', e);
    }
}
