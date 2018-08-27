# Hello, World!

```chart
{
    "type": "bar",
    "data": {
      "labels": [ "Africa", "Asia", "Europe", "Latin America", "North America" ],
      "datasets": [
        {
          "label": "Population (millions)",
          "backgroundColor": [ "#3e95cd", "#8e5ea2","#3cba9f","#e8c3b9","#c45850"],
          "data": [ 2478,5267,734,784,433 ]
        }
      ]
    },
    "options": {
      "legend": { "display": false },
      "title": {
        "display": "true",
        "text": "Predicted world population (millions) in 2050"
      }
    }
}
```

Lorem [ipsum](https://e-go-digital.com/) dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed.

```typescript
var A = '3000';

interface MyInterface {
    foo: number;
    bar: string;
}

function sum(a: number, d: number): MyInterface {
    return {
        foo: a + d,
        bar: ('' + a) + ('' + d)
    };
}

let f = sum(10, 2000);
```

```mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
```
