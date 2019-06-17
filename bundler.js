const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');

const moduleAnalyser = (filename) => {
  const content = fs.readFileSync(filename, 'utf-8')
  const ast = parser.parse(content, {
    sourceType: 'module'
  })
  var dependencies = {}
  traverse(ast, {
    ImportDeclaration({ node }) {
      const dirname = path.dirname(filename)
      const newFile = './' + path.join(dirname, node.source.value)
      dependencies[node.source.value] = newFile
    }
  })
  const { code } = babel.transformFromAst(ast, null, {
		presets: ["@babel/preset-env"]
	})
  return {
    filename,
    dependencies,
    code
  }
}

const makeDependenciesGraph = (entry) => {
  const entryModule =  moduleAnalyser(entry)
  const dependenciesGraphArray = [entryModule] 
  for (let i = 0; i < dependenciesGraphArray.length; i++) {
    if(dependenciesGraphArray[i].dependencies){
      for (let j in dependenciesGraphArray[i].dependencies) {
        const module = moduleAnalyser(dependenciesGraphArray[i].dependencies[j])
        dependenciesGraphArray.push(module)
      }
    } 
  }
  const dependenciesGraph = {}
  dependenciesGraphArray.forEach(item => {
    dependenciesGraph[item.filename] = {
      dependencies: item.dependencies,
			code: item.code
    }
  })
  return dependenciesGraph
}

const generateCode = (entry) => {
  const graph = JSON.stringify(makeDependenciesGraph(entry))
  return `
    (function(graph){
      function require(module) {
        function localRequire(relativePath) {
          return require(graph[module].dependencies[relativePath])
        }
        var exports = {};
        (function(require, exports, code){
					eval(code)
				})(localRequire, exports, graph[module].code)
        return exports
      }
      require('${entry}')
    })(${graph})
  `
}

console.log(generateCode('./src/index.js'))