#!/bin/bash

# Pre-deployment validation script
# Run this before committing to catch common errors

set -e

echo "🔍 Running pre-deployment validation..."

# 1. Syntax check
echo -n "Checking JavaScript syntax... "
if node -c web/app.js 2>/dev/null; then
    echo "✓"
else
    echo "❌"
    echo "ERROR: JavaScript syntax error detected!"
    node -c web/app.js
    exit 1
fi

# 2. Check for const reassignments
echo -n "Checking for const reassignments... "
const_issues=0
while IFS= read -r line; do
    if [[ ! -z "$line" ]]; then
        var_name=$(echo "$line" | sed -n 's/.*const \([a-zA-Z_][a-zA-Z0-9_]*\).*/\1/p')
        if [[ ! -z "$var_name" ]]; then
            if grep -E "^\s*${var_name}\s*=" web/app.js | grep -v "const ${var_name}" >/dev/null 2>&1; then
                if [[ $const_issues -eq 0 ]]; then
                    echo "❌"
                fi
                echo "  ERROR: const variable '$var_name' is reassigned!"
                const_issues=$((const_issues + 1))
            fi
        fi
    fi
done < <(grep -n "^\s*const.*=.*\[\]" web/app.js 2>/dev/null || true)

if [[ $const_issues -eq 0 ]]; then
    echo "✓"
else
    exit 1
fi

# 3. Check class initialization order
echo -n "Checking class initialization order... "
node -e "
const fs = require('fs');
const code = fs.readFileSync('web/app.js', 'utf8');
const classExtends = [...code.matchAll(/class\s+(\w+)\s+extends\s+(\w+)/g)];
const classDefinitions = [...code.matchAll(/class\s+(\w+)/g)].map(m => ({name: m[1], index: m.index}));

let errors = [];
for (const [full, child, parent] of classExtends) {
    const childDef = classDefinitions.find(c => c.name === child);
    const parentDef = classDefinitions.find(c => c.name === parent);
    
    if (!parentDef) {
        errors.push(\`Class '\${parent}' not found (extended by '\${child}')\`);
    } else if (childDef && parentDef.index > childDef.index) {
        errors.push(\`Class '\${parent}' defined after '\${child}' extends it\`);
    }
}

if (errors.length === 0) {
    console.log('✓');
    process.exit(0);
} else {
    console.log('❌');
    errors.forEach(e => console.error('  ERROR:', e));
    process.exit(1);
}
" || exit 1

# 4. Check for common issues
echo -n "Checking for common issues... "
issues=0

# Check for console.log statements (optional warning)
log_count=$(grep -c "console\.log" web/app.js 2>/dev/null || echo "0")
if [[ $log_count -gt 10 ]]; then
    if [[ $issues -eq 0 ]]; then
        echo "⚠️"
    fi
    echo "  WARNING: Found $log_count console.log statements"
    issues=$((issues + 1))
fi

# Check for undefined variables (basic check)
if grep -E "ReferenceError|is not defined" web/app.js >/dev/null 2>&1; then
    if [[ $issues -eq 0 ]]; then
        echo "❌"
    fi
    echo "  ERROR: Found potential undefined variable references"
    exit 1
fi

if [[ $issues -eq 0 ]]; then
    echo "✓"
fi

echo ""
echo "✅ All validation checks passed!"
echo ""
echo "You can now safely commit your changes."