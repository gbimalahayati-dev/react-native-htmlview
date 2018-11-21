import React from 'react';
import {StyleSheet, Text, Dimensions} from 'react-native';
import htmlparser from 'htmlparser2-without-node-native';
import entities from 'entities';

const { width } = Dimensions.get('window');

import AutoSizedImage from './AutoSizedImage';

const defaultOpts = {
  lineBreak: '\n',
  paragraphBreak: '\n\n',
  bullet: '\u2022 ',
  TextComponent: Text,
  textComponentProps: null,
  NodeComponent: Text,
  nodeComponentProps: null,
};

const Img = props => {
  const iWidth =
    parseInt(props.attribs['width'], 10) || parseInt(props.attribs['data-width'], 10) || 0;
  const iHeight =
    parseInt(props.attribs['height'], 10) ||
    parseInt(props.attribs['data-height'], 10) ||
    0;

  const imgStyle = {
    width: iWidth,
    height: iHeight,
  };

  const source = {
    uri: props.attribs.src,
    width: iWidth,
    height: iHeight,
  };
  return <AutoSizedImage source={source} style={imgStyle} />;
};

export default function htmlToElement(rawHtml, customOpts = {}, done) {
  const opts = {
    ...defaultOpts,
    ...customOpts,
  };

  function inheritedStyle(parent) {
    if (!parent) return null;
    const style = StyleSheet.flatten(opts.styles[parent.name]) || {};
    const parentStyle = inheritedStyle(parent.parent) || {};

    return {...parentStyle, ...style};
  }

  function scaling(val){
    return val + ((width / 350 * val) - val) * 0.5;
  }

  function fontScaling(value){
    let val = getPxValue(value);
    return scaling(val);
  }

  function getPxValue(val){
    return Number(val.match(/\d+/)[0]);
  }

  function getInlineStyle(node){
    if(!node) return null;

    let attrStyle = node.attribs.style;
    if(attrStyle == undefined) return null;

    attrStyle = attrStyle.split(";");
    let style = {};
    for(let key in attrStyle){
      const obj = attrStyle[key].split(":");
      let tmp = {};
      let prop;

      const objTrim = obj[0].replace(" ", "");
      switch(objTrim){
        case 'text-align':
          tmp = { textAlign: obj[1] };
          break;
        case 'background-color':
        case 'background':
          tmp = { backgroundColor: obj[1] };
          break;
        case 'color':
          tmp = { color: obj[1] };
          break;
        case 'border':
          prop = obj[1].split(" ");
          tmp = { borderWidth: getPxValue(prop[0]), borderColor: prop[2] };
          break;
        case 'padding':
          prop = obj[1].split(" ");
          if(prop.length === 1){
            tmp = { padding: getPxValue(prop[0]) };
          } else if(prop.length === 2){
            tmp = { paddingVertical: getPxValue(prop[0]), paddingHorizontal: getPxValue(prop[1]) };
          } else if(prop.length === 3){
            tmp = { paddingTop: getPxValue(prop[0]), paddingHorizontal: getPxValue(prop[1]), paddingBottom: getPxValue(prop[2]) };
          } else if(prop.length === 4){
            tmp = { paddingTop: getPxValue(prop[0]), paddingLeft: getPxValue(prop[1]), paddingRight: getPxValue(prop[2]), paddingBottom: getPxValue(prop[3]) };
          }
          break;
        case 'margin':
          prop = obj[1].split(" ");
          if(prop.length === 1){
            tmp = { margin: getPxValue(prop[0]) };
          } else if(prop.length === 2){
            tmp = { marginVertical: getPxValue(prop[0]), marginHorizontal: getPxValue(prop[1]) };
          } else if(prop.length === 3){
            tmp = { marginTop: getPxValue(prop[0]), marginHorizontal: getPxValue(prop[1]), marginBottom: getPxValue(prop[2]) };
          } else if(prop.length === 4){
            tmp = { marginTop: getPxValue(prop[0]), marginLeft: getPxValue(prop[1]), marginRight: getPxValue(prop[2]), marginBottom: getPxValue(prop[3]) };
          }
          break;
        case 'font-size':
          tmp = { fontSize: fontScaling(obj[1]) };
          break;
      }

      style = {
        ...style,
        ...tmp
      };
    }

    return style;
  }

  function domToElement(dom, parent) {
    if (!dom) return null;

    const renderNode = opts.customRenderer;
    let orderedListCounter = 1;

    return dom.map((node, index, list) => {
      if (renderNode) {
        const rendered = renderNode(
          node,
          index,
          list,
          parent,
          domToElement
        );
        if (rendered || rendered === null) return rendered;
      }

      if(!node) return null;

      const {TextComponent} = opts;

      if (node.type === 'text') {
        const defaultStyle = opts.textComponentProps ? opts.textComponentProps.style : null;
        const customStyle = inheritedStyle(parent);
        let mergedStyle = Object.assign({}, defaultStyle && StyleSheet.flatten(defaultStyle), customStyle)
        
        return (
          <TextComponent
            {...opts.textComponentProps}
            key={index}
            style={mergedStyle}
          >
            {entities.decodeHTML(node.data)}
          </TextComponent>
        );
      }

      if (node.type === 'tag') {
        if (node.name === 'img') {
          return <Img key={index} attribs={node.attribs} />;
        }

        let linkPressHandler = null;
        let linkLongPressHandler = null;
        if (node.name === 'a' && node.attribs && node.attribs.href) {
          linkPressHandler = () =>
            opts.linkHandler(entities.decodeHTML(node.attribs.href));
          if (opts.linkLongPressHandler) {
            linkLongPressHandler = () =>
              opts.linkLongPressHandler(entities.decodeHTML(node.attribs.href));
          }
        }

        let linebreakBefore = null;
        let linebreakAfter = null;
        if (opts.addLineBreaks) {
          switch (node.name) {
          case 'pre':
            linebreakBefore = opts.lineBreak;
            break;
          case 'p':
            if (index < list.length - 1) {
              linebreakAfter = opts.paragraphBreak;
            }
            break;
          case 'br':
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
            linebreakAfter = opts.lineBreak;
            break;
          }
        }

        let listItemPrefix = null;
        if (node.name === 'li') {
          const defaultStyle = opts.textComponentProps ? opts.textComponentProps.style : null;
          const customStyle = inheritedStyle(parent);

          if (parent.name === 'ol') {
            listItemPrefix = (<TextComponent style={[defaultStyle, customStyle]}>
              {`${orderedListCounter++}. `}
            </TextComponent>);
          } else if (parent.name === 'ul') {
            listItemPrefix = (<TextComponent style={[defaultStyle, customStyle]}>
              {opts.bullet}
            </TextComponent>);
          }
          if (opts.addLineBreaks && index < list.length - 1) {
            linebreakAfter = opts.lineBreak;
          }
        }

        const {NodeComponent, styles} = opts;

        // Styling
        const attributStyle = getInlineStyle(node) || {};
        let style = attributStyle;
        if(!node.parent){
          style = {...styles[node.name], ...style}
        }

        if(node.name === 'blockquote'){
          const tmp = {
            borderLeftWidth: scaling(4),
            borderLeftColor: '#808080',
            paddingLeft: scaling(10),
            fontStyle: 'italic',
            marginBottom: scaling(10)
          };
          style = { ...style, ...tmp };
        }

        return (
          <NodeComponent
            {...opts.nodeComponentProps}
            key={index}
            onPress={linkPressHandler}
            style={style}
            onLongPress={linkLongPressHandler}
          >
            {linebreakBefore}
            {listItemPrefix}
            {domToElement(node.children, node)}
            {linebreakAfter}
          </NodeComponent>
        );
      }
    });
  }

  const handler = new htmlparser.DomHandler(function(err, dom) {
    if (err) done(err);
    done(null, domToElement(dom));
  });
  const parser = new htmlparser.Parser(handler);
  parser.write(rawHtml);
  parser.done();
}
