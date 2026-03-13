function contar() {
    let i =1;
    while (i <=5) {
        console.log(i)
        i++;
    }
}


function iterarNombres() {
    let nombres =["gero","juan","pedro","maria","ana"]

    for (i=0; i<nombres.length;i++) {
        console.log(nombres[i])
    }
}


function estacionAño(numero) {
    switch (numero) {
  case 1:
    case 2:
        case 12:
    console.log("Verano")
    break;
  case 3:
    case 4:
        case 5:
    console.log("Otoño")
    break;
    case 6:
        case 7:
            case 8:
    console.log("Invierno")
    break;
    case 9:
        case 10:
            case 11:
    console.log("Primavera")
    break;
  default:
    "El numero no coincide con ninguna estacion"
}
}


function numerosPares() {
    

    for (i=1; i<=10;i++) {
        if (i % 2 == 0) {
console.log(i)
        }
    }
}

contar();
iterarNombres()
estacionAño(3)
numerosPares()