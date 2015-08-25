function prefixMethod(methodName, options) {
    options = options || {};
    if (!options.uncapitalized) {
        methodName = methodName.charAt(0).toUpperCase() + methodName.slice(1);
    }
    var parent = options.parent || window;
    var prefixes = options.prefixes || ["webkit", "moz", "o", "ms"];

    var i = 0;
    while (!parent[methodName]) {
        parent[methodName] = parent[prefixes[i++] + methodName];
    }
    return parent[methodName];
}

module.exports = prefixMethod;