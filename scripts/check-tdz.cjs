const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const SRC_DIR = path.resolve(process.cwd(), 'src');
const extensions = new Set(['.ts', '.tsx']);

function listFiles(dir) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(full));
    else if (extensions.has(path.extname(entry.name))) output.push(full);
  }
  return output;
}

function collectBindingNames(name, output = []) {
  if (ts.isIdentifier(name)) output.push(name.text);
  else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) collectBindingNames(element.name, output);
    }
  }
  return output;
}

function lexicalDeclarations(statement) {
  const names = [];
  if (ts.isVariableStatement(statement)) {
    const flags = statement.declarationList.flags;
    const lexical = Boolean(flags & ts.NodeFlags.Let) || Boolean(flags & ts.NodeFlags.Const);
    if (lexical) {
      for (const declaration of statement.declarationList.declarations) {
        collectBindingNames(declaration.name, names);
      }
    }
  } else if (ts.isClassDeclaration(statement) && statement.name) {
    names.push(statement.name.text);
  }
  return names;
}

function isReferenceIdentifier(node) {
  const parent = node.parent;
  if (!parent) return true;

  if (
    ((ts.isVariableDeclaration(parent) ||
      ts.isParameter(parent) ||
      ts.isBindingElement(parent) ||
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isArrowFunction(parent) ||
      ts.isClassDeclaration(parent)) &&
      parent.name === node) ||
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isMethodDeclaration(parent) && parent.name === node) ||
    (ts.isPropertyDeclaration(parent) && parent.name === node) ||
    ts.isImportSpecifier(parent) ||
    ts.isImportClause(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isTypeReferenceNode(parent) ||
    ts.isExpressionWithTypeArguments(parent) ||
    ts.isTypeQueryNode(parent) ||
    (ts.isJsxAttribute(parent) && parent.name === node)
  ) {
    return false;
  }

  return true;
}

function scanFunction(sourceFile, fn, filePath, issues) {
  if (!fn.body || !ts.isBlock(fn.body)) return;

  const statements = [...fn.body.statements];
  const declarationIndex = new Map();

  statements.forEach((statement, index) => {
    for (const name of lexicalDeclarations(statement)) {
      if (!declarationIndex.has(name)) declarationIndex.set(name, index);
    }
  });

  function visitImmediate(node, statementIndex, root) {
    // Corpos de callbacks/funções não são executados durante a avaliação da declaração.
    // Dependências de hooks e argumentos fora desses corpos continuam sendo verificadas.
    if (
      node !== root &&
      (ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isClassExpression(node) ||
        ts.isClassDeclaration(node))
    ) {
      return;
    }

    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      const declaredAt = declarationIndex.get(node.text);
      if (declaredAt !== undefined && declaredAt > statementIndex) {
        const use = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const declaration = sourceFile.getLineAndCharacterOfPosition(statements[declaredAt].getStart(sourceFile));
        issues.push({
          filePath,
          name: node.text,
          useLine: use.line + 1,
          declarationLine: declaration.line + 1,
        });
      }
    }

    ts.forEachChild(node, (child) => visitImmediate(child, statementIndex, root));
  }

  statements.forEach((statement, index) => visitImmediate(statement, index, statement));
}

function scanFile(filePath, issues) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function walk(node) {
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      scanFunction(sourceFile, node, filePath, issues);
    }
    ts.forEachChild(node, walk);
  }

  walk(sourceFile);
}

const issues = [];
for (const filePath of listFiles(SRC_DIR)) scanFile(filePath, issues);

if (issues.length > 0) {
  console.error('\n[check-tdz] ERRO: variável lexical usada antes da inicialização:\n');
  for (const issue of issues) {
    console.error(
      `- ${path.relative(process.cwd(), issue.filePath)}:${issue.useLine} usa "${issue.name}" antes da declaração na linha ${issue.declarationLine}`,
    );
  }
  console.error('\nO build foi interrompido para impedir tela preta no navegador.\n');
  process.exit(1);
}

console.log('[check-tdz] OK: nenhuma variável lexical é avaliada antes da inicialização.');
